const { Client } = require('pg');

exports.handler = async (event, context) => {
    // Only allow GET requests
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { id } = event.queryStringParameters;

    if (!id) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Project ID is required' }) };
    }

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        // Clean ID (remove dashes if any, though we store as is usually)
        // Let's assume user inputs might have dashes or not, but DB allows flexibility.
        // For strict matching, we query directly.

        const result = await client.query('SELECT * FROM projects WHERE project_id = $1', [id]);

        if (result.rows.length === 0) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'Project not found' })
            };
        }

        const project = result.rows[0];

        // Format data to match frontend expectations camelCase
        const formattedData = {
            id: project.project_id,
            client: project.client_name,
            project: project.project_name,
            cost: project.total_cost,
            startDate: project.start_date,
            status: project.status,
            phase: project.current_phase,
            lastUpdated: project.last_updated,
            deadline: project.deadline,
            nextMilestone: project.next_milestone,
            pendingAmount: project.pending_amount,
            downloadLink: project.download_link,
            whatsappLink: "https://wa.me/923010003011" // Static for now
        };

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*' // Enable CORS
            },
            body: JSON.stringify(formattedData)
        };

    } catch (error) {
        console.error('Database Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Database connection failed' })
        };
    } finally {
        await client.end();
    }
};
