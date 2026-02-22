/**
 * New Dependency Detector
 *
 * Detects when new dependencies are added to package.json.
 * This is a "hard fact" detector with high confidence.
 *
 * @module new-dependency-detector
 */

import type {
  DriftFinding,
  DriftDetector,
  DetectorContext,
  DriftEvidence,
} from '../../types/drift-analysis';
import { FINDING_TEMPLATES } from '../../types/drift-analysis';

/**
 * Detector for new dependencies added to package.json
 */
export class NewDependencyDetector implements DriftDetector {
  category = 'new_dependency' as const;

  detect(context: DetectorContext): DriftFinding[] {
    const findings: DriftFinding[] = [];

    for (let i = 0; i < context.frames.length; i++) {
      const frame = context.frames[i];
      if (!frame) continue;

      if (frame.type !== 'tool_execution') continue;

      const diff = frame.toolExecution?.fileDiff;
      if (!diff || !diff.filePath.endsWith('package.json')) continue;

      // Parse old and new content
      try {
        const oldPkg = diff.oldContent ? JSON.parse(diff.oldContent) : {};
        const newPkg = diff.newContent ? JSON.parse(diff.newContent) : {};

        const oldDeps = new Set([
          ...Object.keys(oldPkg.dependencies || {}),
          ...Object.keys(oldPkg.devDependencies || {}),
        ]);

        const newDeps = [
          ...Object.keys(newPkg.dependencies || {}),
          ...Object.keys(newPkg.devDependencies || {}),
        ];

        for (const dep of newDeps) {
          if (!oldDeps.has(dep)) {
            // New dependency found
            findings.push(this.createFinding(dep, diff.filePath, frame.id ?? `frame-${i}`, i));
          }
        }
      } catch {
        // JSON parse error, skip
      }
    }

    return findings;
  }

  private createFinding(
    dep: string,
    filePath: string,
    frameId: string,
    frameIndex: number
  ): DriftFinding {
    const evidence: DriftEvidence[] = [
      {
        type: 'file_diff',
        filePath,
        frameId,
        description: `Added "${dep}" to dependencies`,
      },
    ];

    return {
      id: `new-dep-${frameId}-${dep}`,
      category: this.category,
      severity: 'info',
      confidence: 'high',
      title: FINDING_TEMPLATES.new_dependency.title,
      description: FINDING_TEMPLATES.new_dependency.description.replace('{dep}', dep),
      evidence,
      frameIndex,
      filesAffected: [filePath],
      suggestion: `Review the addition of "${dep}" to ensure it's necessary.`,
    };
  }
}
