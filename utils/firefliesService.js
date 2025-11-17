import axios from "axios";

const FIRE_API_URL = "https://api.fireflies.ai/graphql";
const FIRE_API_KEY = process.env.FIREFLIES_API_KEY;

/**
 * Upload an audio file to Fireflies via public URL
 */

export const uploadRecordingToFireflies = async (fileUrl) => {
    const query = `
    mutation UploadAudio($input: AudioUploadInput!) {
      uploadAudio(input: $input) {
        success
        title
        message
      }
    }
  `;

    try {
        const response = await axios.post(
            FIRE_API_URL,
            {
                query,
                variables: {
                    input: {
                        url: fileUrl,
                        // optionally: title: "Your meeting title"
                        // optionally: attendees: [...]
                    }
                }
            },
            {
                headers: {
                    Authorization: `Bearer ${FIRE_API_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );

        const data = response.data?.data?.uploadAudio;
        if (!data) {
            throw new Error(response.data?.errors?.[0]?.message || "Upload failed");
        }

        return { success: true, data };
    } catch (error) {
        return {
            success: false,
            error: error.response?.data || error.message
        };
    }
};

/**
 * Fetch all meetings / recordings from Fireflies
 */
export const getFirefliesRecordings = async () => {
    const query = `
    query {
      meetings {
        meeting_id
        meeting_name
        meeting_url
        status
        duration
      }
    }
  `;

    try {
        const response = await axios.post(
            FIRE_API_URL,
            { query },
            {
                headers: {
                    Authorization: `Bearer ${FIRE_API_KEY}`,
                    "Content-Type": "application/json",
                },
            }
        );

        const data = response.data?.data?.meetings;
        return { success: true, data };
    } catch (error) {
        console.error("Fireflies fetch error:", error.response?.data || error.message);
        return {
            success: false,
            error: error.response?.data || error.message,
        };
    }
};
