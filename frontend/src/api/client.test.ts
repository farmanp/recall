/**
 * Simple test file to verify API client functionality
 * Run this with: node --loader ts-node/esm client.test.ts
 * Or use it as a reference for integration tests
 */

import { apiClient, ApiClientError } from './client';

/**
 * Test all API endpoints
 */
async function runTests() {
  console.log('Starting API Client Tests...\n');

  try {
    // Test 1: Health Check
    console.log('1. Testing Health Check...');
    const health = await apiClient.healthCheck();
    console.log('   ✓ Health Check:', health);
    console.log('');

    // Test 2: List Sessions
    console.log('2. Testing List Sessions...');
    const sessionList = await apiClient.listSessions({ offset: 0, limit: 5 });
    console.log(`   ✓ Found ${sessionList.total} total sessions`);
    console.log(`   ✓ Returned ${sessionList.sessions.length} sessions`);
    if (sessionList.sessions.length > 0) {
      console.log(`   ✓ First session ID: ${sessionList.sessions[0].id}`);
      console.log(`   ✓ First session status: ${sessionList.sessions[0].status}`);
    }
    console.log('');

    // Test 3: Get Session Details (if we have any sessions)
    if (sessionList.sessions.length > 0) {
      const firstSessionId = sessionList.sessions[0].id;
      console.log(`3. Testing Get Session Details (ID: ${firstSessionId})...`);
      const sessionDetails = await apiClient.getSession(firstSessionId);
      console.log(`   ✓ Session: ${sessionDetails.session.claude_session_id}`);
      console.log(`   ✓ Event Count: ${sessionDetails.eventCount}`);
      console.log(`   ✓ Prompt Count: ${sessionDetails.promptCount}`);
      console.log(`   ✓ Observation Count: ${sessionDetails.observationCount}`);
      console.log('');

      // Test 4: Get Session Events
      console.log(`4. Testing Get Session Events (ID: ${firstSessionId})...`);
      const events = await apiClient.getSessionEvents(firstSessionId, {
        offset: 0,
        limit: 10,
      });
      console.log(`   ✓ Found ${events.total} total events`);
      console.log(`   ✓ Returned ${events.events.length} events`);
      if (events.events.length > 0) {
        console.log(`   ✓ First event type: ${events.events[0].event_type}`);
        console.log(`   ✓ First event text: ${events.events[0].text.substring(0, 50)}...`);
      }
      console.log('');

      // Test 5: Get Specific Event (if we have any)
      if (events.events.length > 0) {
        const firstEvent = events.events[0];
        console.log(
          `5. Testing Get Event (Type: ${firstEvent.event_type}, ID: ${firstEvent.row_id})...`
        );
        const event = await apiClient.getEvent(
          firstSessionId,
          firstEvent.event_type,
          firstEvent.row_id
        );
        console.log(`   ✓ Event retrieved successfully`);
        console.log(`   ✓ Event has ${Object.keys(event).length} properties`);
        console.log('');
      }
    }

    // Test 6: Error Handling
    console.log('6. Testing Error Handling...');
    try {
      await apiClient.getSession(999999);
      console.log('   ✗ Should have thrown an error');
    } catch (error) {
      if (error instanceof ApiClientError) {
        console.log(`   ✓ Correctly caught ApiClientError: ${error.message}`);
        console.log(`   ✓ Status Code: ${error.statusCode}`);
      } else {
        console.log('   ✗ Wrong error type');
      }
    }
    console.log('');

    console.log('All tests completed successfully! ✓');
  } catch (error) {
    console.error('Test failed:', error);
    if (error instanceof ApiClientError) {
      console.error('Status Code:', error.statusCode);
      console.error('Response:', error.response);
    }
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}

export { runTests };
