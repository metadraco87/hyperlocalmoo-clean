export async function POST({ request }: { request: Request }) {
    try {
        const violation = await request.json();
        
        // Log CSP violation for debugging
        console.log('🚨 CSP Violation Report:', JSON.stringify(violation, null, 2));
        
        // In production, you might want to send this to a logging service
        // For now, we'll just log it and return 204 No Content
        
        return new Response(null, { 
            status: 204,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('Error processing CSP violation report:', error);
        return new Response(null, { 
            status: 204,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
}

