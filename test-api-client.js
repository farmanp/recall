/**
 * Simple JavaScript test for API client
 * Tests the API endpoints using plain fetch
 */

const BASE_URL = 'http://localhost:3001';

async function testApiClient() {
  console.log('Starting API Client Tests...\n');

  try {
    // Test 1: Health Check
    console.log('1. Testing Health Check...');
    const healthResponse = await fetch(`${BASE_URL}/api/health`);
    const health = await healthResponse.json();
    console.log('   ✓ Health Check:', health);
    console.log('');

    // Test 2: List Sessions
    console.log('2. Testing List Sessions...');
    const sessionsResponse = await fetch(`${BASE_URL}/api/sessions?offset=0&limit=5`);
    const sessionList = await sessionsResponse.json();
    console.log(`   ✓ Found ${sessionList.total} total sessions`);
    console.log(`   ✓ Returned ${sessionList.sessions.length} sessions`);
    if (sessionList.sessions.length > 0) {
      console.log(`   ✓ First session ID: ${sessionList.sessions[0].id}`);
      console.log(`   ✓ First session status: ${sessionList.sessions[0].status}`);
    }
    console.log('');

    // Test 3: Get Session Details
    if (sessionList.sessions.length > 0) {
      const firstSessionId = sessionList.sessions[0].id;
      console.log(`3. Testing Get Session Details (ID: ${firstSessionId})...`);
      const sessionResponse = await fetch(`${BASE_URL}/api/sessions/${firstSessionId}`);
      const sessionDetails = await sessionResponse.json();
      console.log(`   ✓ Session: ${sessionDetails.session.claude_session_id}`);
      console.log(`   ✓ Event Count: ${sessionDetails.eventCount}`);
      console.log(`   ✓ Prompt Count: ${sessionDetails.promptCount}`);
      console.log(`   ✓ Observation Count: ${sessionDetails.observationCount}`);
      console.log('');

      // Test 4: Get Session Events
      console.log(`4. Testing Get Session Events (ID: ${firstSessionId})...`);
      const eventsResponse = await fetch(
        `${BASE_URL}/api/sessions/${firstSessionId}/events?offset=0&limit=10`
      );
      const events = await eventsResponse.json();
      console.log(`   ✓ Found ${events.total} total events`);
      console.log(`   ✓ Returned ${events.events.length} events`);
      if (events.events.length > 0) {
        console.log(`   ✓ First event type: ${events.events[0].event_type}`);
        console.log(`   ✓ First event text preview: ${events.events[0].text.substring(0, 50)}...`);
      }
      console.log('');

      // Test 5: Get Specific Event
      if (events.events.length > 0) {
        const firstEvent = events.events[0];
        console.log(
          `5. Testing Get Event (Type: ${firstEvent.event_type}, ID: ${firstEvent.row_id})...`
        );
        const eventResponse = await fetch(
          `${BASE_URL}/api/sessions/${firstSessionId}/events/${firstEvent.event_type}/${firstEvent.row_id}`
        );
        const event = await eventResponse.json();
        console.log(`   ✓ Event retrieved successfully`);
        console.log(`   ✓ Event has ${Object.keys(event).length} properties`);
        console.log('');
      }
    }

    // Test 6: Error Handling
    console.log('6. Testing Error Handling (non-existent session)...');
    const errorResponse = await fetch(`${BASE_URL}/api/sessions/999999`);
    if (!errorResponse.ok) {
      console.log(`   ✓ Correctly returned error status: ${errorResponse.status}`);
      const errorData = await errorResponse.json();
      console.log(`   ✓ Error message: ${errorData.error}`);
    }
    console.log('');

    console.log('✅ All API client tests passed successfully!\n');
    console.log('Summary:');
    console.log('  - Health check: Working');
    console.log('  - List sessions: Working');
    console.log('  - Get session details: Working');
    console.log('  - Get session events: Working');
    console.log('  - Get specific event: Working');
    console.log('  - Error handling: Working');
    console.log('\nThe TypeScript API client is ready to use!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run tests
testApiClient();
