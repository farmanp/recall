// Quick test script to verify the parser works
const { parseTranscriptFile } = require('./dist/parser/transcript-parser');
const { buildTimeline } = require('./dist/parser/timeline-builder');
const { getSessionIndexer } = require('./dist/parser/session-indexer');

async function test() {
  console.log('Testing session indexer...');

  // Test indexer
  const indexer = getSessionIndexer();
  const sessions = await indexer.buildIndex();

  console.log(`Found ${sessions.length} sessions`);

  if (sessions.length > 0) {
    const session = sessions[0];
    console.log('\nFirst session:');
    console.log(`  ID: ${session.sessionId}`);
    console.log(`  Slug: ${session.slug}`);
    console.log(`  Project: ${session.project}`);
    console.log(`  Events: ${session.eventCount}`);
    console.log(`  Start: ${session.startTime}`);

    // Test parser
    console.log('\nTesting parser...');
    const filePath = await indexer.findSessionFile(session.sessionId);

    if (filePath) {
      console.log(`  File: ${filePath}`);

      const transcript = await parseTranscriptFile(filePath);
      console.log(`  Parsed ${transcript.entries.length} entries`);

      // Test timeline builder
      console.log('\nTesting timeline builder...');
      const timeline = await buildTimeline(transcript);
      console.log(`  Built timeline with ${timeline.totalFrames} frames`);

      // Show first few frames
      console.log('\nFirst 5 frames:');
      timeline.frames.slice(0, 5).forEach((frame, i) => {
        console.log(`  ${i + 1}. ${frame.type} (${frame.duration}ms)`);
        if (frame.userMessage) {
          console.log(`     User: ${frame.userMessage.text.substring(0, 60)}...`);
        }
        if (frame.claudeResponse) {
          console.log(`     Claude: ${frame.claudeResponse.text.substring(0, 60)}...`);
        }
        if (frame.toolExecution) {
          console.log(`     Tool: ${frame.toolExecution.tool}`);
        }
      });
    }
  }
}

test().catch(console.error);
