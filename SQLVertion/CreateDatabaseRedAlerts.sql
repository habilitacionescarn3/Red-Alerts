
-- Create Events Table
CREATE TABLE Events (
    event_id INT IDENTITY(1,1) PRIMARY KEY,   -- Auto-increment primary key
    id VARCHAR(50) UNIQUE NOT NULL,           -- Unique identifier from the event object
    category VARCHAR(50),                     -- Category (e.g., "1")
    title VARCHAR(255),                       -- Event title
    description VARCHAR(500),                 -- Event description
    event_time DATETIME                       -- Time of the event
);

-- Create Locations Table
CREATE TABLE Locations (
    location_id INT IDENTITY(1,1) PRIMARY KEY,  -- Auto-increment primary key
    location_name VARCHAR(255)                  -- The name of the location
);

-- Create Event_Location Table (Link between Events and Locations)
CREATE TABLE Event_Location (
    event_id INT,                             -- Foreign key from Events table
    location_id INT,                          -- Foreign key from Locations table
    PRIMARY KEY (event_id, location_id),      -- Composite primary key
    FOREIGN KEY (event_id) REFERENCES Events(event_id),      -- Foreign key constraint
    FOREIGN KEY (location_id) REFERENCES Locations(location_id)  -- Foreign key constraint
);

-- Create Coordinates Table
CREATE TABLE Coordinates (
    coordinate_id INT IDENTITY(1,1) PRIMARY KEY,  -- Auto-increment primary key
    address NVARCHAR(255) NOT NULL,              -- Address name
    lat FLOAT NOT NULL,                          -- Latitude
    lon FLOAT NOT NULL                           -- Longitude
);

-- Stored Procedure: AddNewEvent
CREATE PROCEDURE AddNewEvent
    @id VARCHAR(50),
    @category VARCHAR(50),
    @title VARCHAR(255),
    @description VARCHAR(500),
    @event_time DATETIME,
    @locations NVARCHAR(MAX)  -- JSON array of locations
AS
BEGIN
    SET NOCOUNT ON;

    -- Check if the event already exists
    IF EXISTS (SELECT 1 FROM Events WHERE id = @id)
    BEGIN
        PRINT 'Event already exists.';
        RETURN;
    END

    -- Insert new event
    DECLARE @event_id INT;
    INSERT INTO Events (id, category, title, description, event_time)
    VALUES (@id, @category, @title, @description, @event_time);

    SET @event_id = SCOPE_IDENTITY();  -- Capture the newly inserted event_id
    PRINT 'Inserted new event with event_id: ' + CAST(@event_id AS VARCHAR(10));

    -- Parse JSON locations and insert them
    DECLARE @location NVARCHAR(255);
    DECLARE @location_id INT;
    DECLARE @jsonLocations TABLE (location NVARCHAR(255));

    INSERT INTO @jsonLocations (location)
    SELECT value FROM OPENJSON(@locations);

    -- Loop through the locations
    DECLARE location_cursor CURSOR FOR
    SELECT location FROM @jsonLocations;

    OPEN location_cursor;
    FETCH NEXT FROM location_cursor INTO @location;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        -- Check if the location already exists
        IF NOT EXISTS (SELECT 1 FROM Locations WHERE location_name = @location)
        BEGIN
            -- Insert new location
            INSERT INTO Locations (location_name)
            VALUES (@location);

            SET @location_id = SCOPE_IDENTITY();
        END
        ELSE
        BEGIN
            -- Get the existing location_id
            SELECT @location_id = location_id
            FROM Locations
            WHERE location_name = @location;
        END

        -- Insert into Event_Location table
        IF NOT EXISTS (SELECT 1 FROM Event_Location WHERE event_id = @event_id AND location_id = @location_id)
        BEGIN
            INSERT INTO Event_Location (event_id, location_id)
            VALUES (@event_id, @location_id);
        END

        FETCH NEXT FROM location_cursor INTO @location;
    END

    CLOSE location_cursor;
    DEALLOCATE location_cursor;

    PRINT 'Event and locations successfully inserted.';
END;


-- Stored Procedure: GetEventsByDate
CREATE PROCEDURE GetEventsByDate
    @input_date DATE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @start_datetime DATETIME = DATEADD(HOUR, -3, CAST(@input_date AS DATETIME));  -- Start from midnight Israel time in UTC
    DECLARE @end_datetime DATETIME = DATEADD(HOUR, 21, CAST(@input_date AS DATETIME));    -- End of day Israel time in UTC

    -- Select events and return locations as a JSON array
    SELECT 
        E.id,
        E.category AS cat,
        E.title,
        (
            SELECT L.location_name
            FROM Event_Location EL
            JOIN Locations L ON EL.location_id = L.location_id
            WHERE EL.event_id = E.event_id
            FOR JSON PATH
        ) AS data, 
        E.description AS [desc],
        E.event_time AS [time]
    FROM Events E
    WHERE E.event_time BETWEEN @start_datetime AND @end_datetime
    FOR JSON PATH, ROOT('events');
END;


-- Stored Procedure: InsertOrUpdateCoordinates
CREATE PROCEDURE InsertOrUpdateCoordinates
    @address NVARCHAR(255),
    @lat FLOAT,
    @lon FLOAT
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (SELECT 1 FROM Coordinates WHERE address = @address)
    BEGIN
        -- Update coordinates
        UPDATE Coordinates
        SET lat = @lat, lon = @lon
        WHERE address = @address;
    END
    ELSE
    BEGIN
        -- Insert new coordinates
        INSERT INTO Coordinates (address, lat, lon)
        VALUES (@address, @lat, @lon);
    END
END;


-- Stored Procedure: GetCoordinatesByEventDate
CREATE PROCEDURE GetCoordinatesByEventDate
    @input_date DATE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @start_datetime DATETIME = DATEADD(HOUR, -3, CAST(@input_date AS DATETIME));  -- Start from midnight Israel time in UTC
    DECLARE @end_datetime DATETIME = DATEADD(HOUR, 21, CAST(@input_date AS DATETIME));    -- End of day Israel time in UTC

    -- Select coordinates and include locations without coordinates
    SELECT DISTINCT
        L.location_name AS address,
        C.lat,
        C.lon
    FROM Event_Location EL
    JOIN Locations L ON EL.location_id = L.location_id  
    LEFT JOIN Coordinates C ON L.location_name = C.address 
    JOIN Events E ON EL.event_id = E.event_id
    WHERE E.event_time BETWEEN @start_datetime AND @end_datetime
    FOR JSON PATH, ROOT('coordinates');
END;

CREATE PROCEDURE GetAllAlerts
AS
BEGIN
    SET NOCOUNT ON;

    -- Select all events and their associated locations
    SELECT 
        E.id,
        E.category AS cat,
        E.title,
        (
            SELECT L.location_name
            FROM Event_Location EL
            JOIN Locations L ON EL.location_id = L.location_id
            WHERE EL.event_id = E.event_id
            FOR JSON PATH
        ) AS data, 
        E.description AS [desc],
        E.event_time AS [time]
    FROM Events E
    FOR JSON PATH, ROOT('alerts');
END;

CREATE PROCEDURE GetAllLocations
AS
BEGIN
    SET NOCOUNT ON;

    -- Select all locations with coordinates
    SELECT 
        L.location_name AS address,
        C.lat,
        C.lon
    FROM Locations L
    JOIN Coordinates C ON L.location_name = C.address
    FOR JSON PATH, ROOT('locations');
END;

CREATE PROCEDURE UpdateOrInsertLocationAndCoordinates
    @location_name NVARCHAR(255),
    @lat FLOAT,
    @lon FLOAT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @location_id INT;

    -- Check if the location already exists in the Locations table
    IF NOT EXISTS (SELECT 1 FROM Locations WHERE location_name = @location_name)
    BEGIN
        -- Insert the location into the Locations table
        INSERT INTO Locations (location_name)
        VALUES (@location_name);

        -- Get the newly inserted location_id
        SET @location_id = SCOPE_IDENTITY();
    END
    ELSE
    BEGIN
        -- Get the existing location_id
        SELECT @location_id = location_id
        FROM Locations
        WHERE location_name = @location_name;
    END

    -- Check if the coordinates already exist for the location
    IF EXISTS (SELECT 1 FROM Coordinates WHERE address = @location_name)
    BEGIN
        -- Update the coordinates for the existing location
        UPDATE Coordinates
        SET lat = @lat, lon = @lon
        WHERE address = @location_name;
    END
    ELSE
    BEGIN
        -- Insert new coordinates for the location
        INSERT INTO Coordinates (address, lat, lon)
        VALUES (@location_name, @lat, @lon);
    END
END;

CREATE PROCEDURE RemoveLocation
    @location_name NVARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @location_id INT;

    -- Get the location_id from the Locations table
    SELECT @location_id = location_id
    FROM Locations
    WHERE location_name = @location_name;

    -- If the location exists, proceed with the deletion
    IF @location_id IS NOT NULL
    BEGIN
        -- Remove the relationship from the Event_Location table
        DELETE FROM Event_Location
        WHERE location_id = @location_id;

        -- Remove the coordinates from the Coordinates table
        DELETE FROM Coordinates
        WHERE address = @location_name;

        -- Remove the location from the Locations table
        DELETE FROM Locations
        WHERE location_id = @location_id;

        PRINT 'Location and associated data removed successfully.';
    END
    ELSE
    BEGIN
        PRINT 'Location does not exist.';
    END
END;

-- Test deleting all data from the tables
DELETE FROM Event_Location;
DELETE FROM Events;
DELETE FROM Locations;
DELETE FROM Coordinates;

-- Test select statements
SELECT * FROM Events;
SELECT * FROM Locations;
SELECT * FROM Event_Location;
SELECT * FROM Coordinates ORDER BY Coordinates.address;
SELECT * FROM Locations where Locations.location_name= 'טובא זנגריה';


-- Insert a test event using the AddNewEvent stored procedure
EXEC AddNewEvent
    @id = '3967',
    @category = '1',
    @title = 'test',
    @description = N'היכנסו למרחב המוגן ושהו בו 10 דקות',
    @event_time = '2024-10-23T03:21:00',
    @locations = N'["שומרה","עכו"]';

-- Test GetEventsByDate stored procedure
EXEC GetEventsByDate '2024-10-12';

-- Test GetCoordinatesByEventDate stored procedure
EXEC GetCoordinatesByEventDate '2024-10-08';

EXEC GetAllAlerts
EXEC RemoveLocation @location_name = N'מלון אחוזת הירדן';

select * FROM Events
where id='3967'

delete  from Event_Location
where event_id='3599'
DELETE   FROM Events
where id='3967'