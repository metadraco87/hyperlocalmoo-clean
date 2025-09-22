// Connection User Updater Component
// This component updates the profile pictures and usernames of connections

/**
 * Updates connection information with the latest profile data
 * @param connections - Array of connection objects
 * @param token - Authentication token
 * @returns - Updated connections array
 */
export default async function updateConnectionUserInfo(
  connections: any[], 
  token: string
): Promise<any[]> {
  if (!connections || !Array.isArray(connections) || !token) return connections;
  
  // Process connections to get the latest profile data
  return Promise.all(connections.map(async (connection) => {
    try {
      // Only try to update if we have an email to work with
      if (connection.email) {
        const updatedProfile = await import('$lib/api')
          .then(api => api.getUserProfileByEmail(connection.email, token, true));
        
        // If we got updated info, merge it with the connection
        if (updatedProfile) {
          return {
            ...connection,
            username: updatedProfile.username || connection.username,
            profileImageUrl: updatedProfile.profileImageUrl || connection.profileImageUrl
          };
        }
      }
      return connection;
    } catch (error) {
      console.error(`Error updating connection info for ${connection.email}:`, error);
      return connection;
    }
  }));
}
