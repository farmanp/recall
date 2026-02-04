// Test with current session
const { parseTranscriptFile } = require('./dist/parser/transcript-parser');
const { buildTimeline } = require('./dist/parser/timeline-builder');
const path = require('path');
const os = require('os');

async function test() {
  const currentSessionFile = path.join(
    os.homedir(),
    '.claude',
    'projects',
    '-Users-fpirzada-Documents-cc-mem-video-player',
    '4b198fdf-b80d-4bbc-806f-2900282cdc56.jsonl'
  );

  console.log('Testing current session...');
  console.log(`File: ${currentSessionFile}`);

  const transcript = await parseTranscriptFile(currentSessionFile);
  console.log(`\nParsed ${transcript.entries.length} entries`);

  const timeline = await buildTimeline(transcript);
  console.log(`Built timeline with ${timeline.totalFrames} frames`);
  console.log(`Session: ${timeline.slug}`);
  console.log(`Project: ${timeline.project}`);

  // Show frame type distribution
  const frameTypes = {};
  timeline.frames.forEach((frame) => {
    frameTypes[frame.type] = (frameTypes[frame.type] || 0) + 1;
  });

  console.log('\nFrame type distribution:');
  Object.entries(frameTypes).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });

  // Show first 10 frames
  console.log('\nFirst 10 frames:');
  timeline.frames.slice(0, 10).forEach((frame, i) => {
    console.log(`  ${i + 1}. ${frame.type} (${frame.duration}ms)`);
    if (frame.userMessage) {
      const preview = frame.userMessage.text.substring(0, 80).replace(/\n/g, ' ');
      console.log(`     User: ${preview}...`);
    }
    if (frame.claudeResponse) {
      const preview = frame.claudeResponse.text.substring(0, 80).replace(/\n/g, ' ');
      console.log(`     Claude: ${preview}...`);
    }
    if (frame.toolExecution) {
      console.log(`     Tool: ${frame.toolExecution.tool}`);
      if (frame.toolExecution.fileDiff) {
        console.log(`       File: ${frame.toolExecution.fileDiff.filePath}`);
      }
    }
  });
}

test().catch(console.error);
