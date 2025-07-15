// api/webhook.js - Vercel serverless function
// Receives PPM appointment data and creates blocked appointments in Nookal

export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Received PPM webhook:', JSON.stringify(req.body, null, 2));
    
    // Extract appointment data from PPM webhook
    const customData = req.body.customData || {};
    const contact = req.body.contact || {};
    
    // Map PPM data to Nookal format
    const appointmentData = {
      appointment_id: customData.appointment_id,
      start_date: customData.start_date,
      start_time: customData.start_time,
      end_date: customData.end_date,
      end_time: customData.end_time,
      contact_name: customData.contact_name || contact.full_name,
      contact_email: customData.contact_email || contact.email,
      practitioner_name: customData.practitioner_name || 'Not specified'
    };

    console.log('Mapped appointment data:', appointmentData);

    // TODO: Replace with your actual Nookal API key
    const NOOKAL_API_KEY = process.env.NOOKAL_API_KEY;
    
    if (!NOOKAL_API_KEY) {
      console.error('NOOKAL_API_KEY not found in environment variables');
      return res.status(500).json({ error: 'Nookal API key not configured' });
    }

    // Format date and time for Nookal API
    const nookalAppointment = {
      // Map practitioner - you'll need to create a mapping function
      practitioner_id: mapPractitionerToNookal(appointmentData.practitioner_name),
      
      // Convert date format from "July 16, 2025" to "2025-07-16"
      appointment_date: formatDateForNookal(appointmentData.start_date),
      
      // Convert time format from "7:00 AM" to "07:00"
      appointment_time: formatTimeForNookal(appointmentData.start_time),
      
      // Calculate duration from start and end times
      duration: calculateDuration(appointmentData.start_time, appointmentData.end_time),
      
      // Set as blocked appointment
      appointment_type: "BLOCKED",
      client_name: `PPM Booking - ${appointmentData.contact_name}`,
      notes: `Blocked due to PPM appointment ID: ${appointmentData.appointment_id}`,
      status: "confirmed"
    };

    console.log('Nookal appointment data:', nookalAppointment);

    // Send to Nookal API
    const nookalResponse = await fetch('https://au-apiv3.nookal.com/appointments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOOKAL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(nookalAppointment)
    });

    if (!nookalResponse.ok) {
      const errorText = await nookalResponse.text();
      console.error('Nookal API error:', errorText);
      return res.status(500).json({ 
        error: 'Failed to create Nookal appointment',
        details: errorText 
      });
    }

    const nookalResult = await nookalResponse.json();
    console.log('Nookal appointment created:', nookalResult);

    // Success response
    return res.status(200).json({
      success: true,
      message: 'Appointment blocked in Nookal successfully',
      ppm_appointment_id: appointmentData.appointment_id,
      nookal_response: nookalResult
    });

  } catch (error) {
    console.error('Integration error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}

// Helper function to map PPM practitioner names to Nookal practitioner IDs
function mapPractitionerToNookal(practitionerName) {
  // TODO: Create mapping based on your practitioners
  const practitionerMap = {
    'Dr. Smith': 'nookal_practitioner_id_1',
    'Dr. Johnson': 'nookal_practitioner_id_2',
    'Dr. Brown': 'nookal_practitioner_id_3',
    // Add your actual practitioner mappings here
  };
  
  return practitionerMap[practitionerName] || 'default_practitioner_id';
}

// Convert "July 16, 2025" to "2025-07-16"
function formatDateForNookal(dateString) {
  if (!dateString) return null;
  
  try {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD
  } catch (error) {
    console.error('Date formatting error:', error);
    return null;
  }
}

// Convert "7:00 AM" to "07:00"
function formatTimeForNookal(timeString) {
  if (!timeString) return null;
  
  try {
    const date = new Date(`1970-01-01 ${timeString}`);
    return date.toTimeString().slice(0, 5); // Returns HH:MM
  } catch (error) {
    console.error('Time formatting error:', error);
    return null;
  }
}

// Calculate duration in minutes between start and end times
function calculateDuration(startTime, endTime) {
  if (!startTime || !endTime) return 60; // Default 60 minutes
  
  try {
    const start = new Date(`1970-01-01 ${startTime}`);
    const end = new Date(`1970-01-01 ${endTime}`);
    const diffMs = end - start;
    const diffMins = Math.round(diffMs / 60000);
    return diffMins > 0 ? diffMins : 60;
  } catch (error) {
    console.error('Duration calculation error:', error);
    return 60;
  }
}

