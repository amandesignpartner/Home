const { Client } = require('pg');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const data = JSON.parse(event.body);
        const { project, client: clientName, rating, message } = data;

        // Basic validation
        if (!rating || !message) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
        }

        await client.connect();

        const query = `
            INSERT INTO feedback (project_id, client_name, rating, message)
            VALUES ($1, $2, $3, $4)
            RETURNING id
        `;

        const values = [project || 'Anonymous', clientName || 'Anonymous', rating, message];
        const result = await client.query(query, values);

        return {
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ message: 'Feedback submitted successfully', id: result.rows[0].id })
        };

    } catch (error) {
        console.error('Feedback Submission Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to submit feedback' })
        };
    } finally {
        await client.end();
    }
};
