const { Client } = require('pg');

exports.handler = async (event, context) => {
    // This should ideally be protected by some auth, but for now we'll keep it simple as requested
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const data = JSON.parse(event.body);

        // Destructure all expected fields
        const {
            id, client: clientName, project, cost, start,
            status, phase, updated, deadline, milestone,
            pending, downloadLink
        } = data;

        if (!id) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Project ID is required' }) };
        }

        await client.connect();

        // Check if project exists
        const checkRes = await client.query('SELECT 1 FROM projects WHERE project_id = $1', [id]);

        let query = '';
        let values = [];

        if (checkRes.rows.length > 0) {
            // Update existing
            query = `
                UPDATE projects SET 
                    client_name = $2, project_name = $3, total_cost = $4, start_date = $5,
                    status = $6, current_phase = $7, last_updated = $8, deadline = $9,
                    next_milestone = $10, pending_amount = $11, download_link = $12
                WHERE project_id = $1
            `;
            values = [id, clientName, project, cost, start, status, phase, updated, deadline, milestone, pending, downloadLink];
        } else {
            // Insert new
            query = `
                INSERT INTO projects 
                (project_id, client_name, project_name, total_cost, start_date, status, current_phase, last_updated, deadline, next_milestone, pending_amount, download_link)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            `;
            values = [id, clientName, project, cost, start, status, phase, updated, deadline, milestone, pending, downloadLink];
        }

        await client.query(query, values);

        return {
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ message: 'Project saved successfully' })
        };

    } catch (error) {
        console.error('Update Project Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to save project' })
        };
    } finally {
        await client.end();
    }
};
