/**
 * DiffViewer Example Usage
 *
 * This file demonstrates various use cases for the DiffViewer component
 */

import React from 'react';
import { DiffViewer } from './DiffViewer';

export const DiffViewerExamples: React.FC = () => {
  // Example 1: Edit Tool - Simple variable change
  const example1Old = `const greeting = 'Hello';
const name = 'World';
console.log(greeting + ' ' + name);`;

  const example1New = `const greeting = 'Hi';
const name = 'Everyone';
const message = \`\${greeting} \${name}!\`;
console.log(message);`;

  // Example 2: Write Tool - New file
  const example2New = `import React from 'react';

export const NewComponent: React.FC = () => {
  return (
    <div className="container">
      <h1>Hello World</h1>
    </div>
  );
};`;

  // Example 3: Large file edit with multiple changes
  const example3Old = `function processData(data) {
  const results = [];
  for (let i = 0; i < data.length; i++) {
    if (data[i].active) {
      results.push(data[i]);
    }
  }
  return results;
}

function formatDate(date) {
  return date.toLocaleDateString();
}

export { processData, formatDate };`;

  const example3New = `function processData(data) {
  return data.filter(item => item.active);
}

function formatDate(date, locale = 'en-US') {
  return new Intl.DateTimeFormat(locale).format(date);
}

function formatTime(date) {
  return date.toLocaleTimeString();
}

export { processData, formatDate, formatTime };`;

  return (
    <div className="space-y-8 p-8 bg-gray-900 min-h-screen">
      <h1 className="text-3xl font-bold text-white mb-8">DiffViewer Examples</h1>

      {/* Example 1: Edit Tool */}
      <section>
        <h2 className="text-xl font-semibold text-white mb-4">
          Example 1: Edit Tool - Variable Changes
        </h2>
        <DiffViewer
          filePath="/src/examples/greeting.ts"
          oldContent={example1Old}
          newContent={example1New}
          language="typescript"
          isEdit={true}
        />
      </section>

      {/* Example 2: Write Tool */}
      <section>
        <h2 className="text-xl font-semibold text-white mb-4">
          Example 2: Write Tool - New File Creation
        </h2>
        <DiffViewer
          filePath="/src/components/NewComponent.tsx"
          oldContent={undefined}
          newContent={example2New}
          language="typescript"
          isEdit={false}
        />
      </section>

      {/* Example 3: Complex Edit */}
      <section>
        <h2 className="text-xl font-semibold text-white mb-4">
          Example 3: Complex Edit - Refactoring
        </h2>
        <DiffViewer
          filePath="/src/utils/dataUtils.js"
          oldContent={example3Old}
          newContent={example3New}
          language="javascript"
          isEdit={true}
        />
      </section>

      {/* Example 4: Python File */}
      <section>
        <h2 className="text-xl font-semibold text-white mb-4">Example 4: Python File Edit</h2>
        <DiffViewer
          filePath="/scripts/process.py"
          oldContent={`def calculate_sum(numbers):
    total = 0
    for num in numbers:
        total += num
    return total`}
          newContent={`def calculate_sum(numbers):
    """Calculate the sum of a list of numbers."""
    return sum(numbers)`}
          language="python"
          isEdit={true}
        />
      </section>

      {/* Example 5: JSON Configuration */}
      <section>
        <h2 className="text-xl font-semibold text-white mb-4">
          Example 5: JSON Configuration Change
        </h2>
        <DiffViewer
          filePath="/config/settings.json"
          oldContent={`{
  "port": 3000,
  "host": "localhost",
  "debug": true
}`}
          newContent={`{
  "port": 8080,
  "host": "0.0.0.0",
  "debug": false,
  "cors": {
    "enabled": true,
    "origins": ["*"]
  }
}`}
          language="json"
          isEdit={true}
        />
      </section>
    </div>
  );
};

export default DiffViewerExamples;
