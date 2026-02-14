-- Run these commands in your Neon SQL Editor to set up the database

-- 1. Create Projects Table
CREATE TABLE IF NOT EXISTS projects (
    project_id VARCHAR(50) PRIMARY KEY, -- This will be the unique ID like AGW260801
    client_name VARCHAR(100),
    project_name VARCHAR(200),
    total_cost VARCHAR(50),
    start_date VARCHAR(20),
    status VARCHAR(20), -- 'progress', 'waiting', 'completed'
    current_phase VARCHAR(100),
    last_updated VARCHAR(20),
    deadline VARCHAR(20),
    next_milestone VARCHAR(100),
    pending_amount VARCHAR(50),
    download_link TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create Feedback Table
CREATE TABLE IF NOT EXISTS feedback (
    id SERIAL PRIMARY KEY,
    project_id VARCHAR(50),
    client_name VARCHAR(100),
    rating INTEGER,
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Insert Dummy Data (Optional - for testing)
INSERT INTO projects (project_id, client_name, project_name, total_cost, start_date, status, current_phase, last_updated, deadline, next_milestone, pending_amount, download_link)
VALUES 
('AGW260801', 'Andy King', 'Premium Gym Interior', '$4,500 USD', '01/01/2026', 'progress', '3D Modeling', '6 Jan 2026', '10 Jan 2026', 'Final Review', 'NONE', 'https://drive.google.com/...');
