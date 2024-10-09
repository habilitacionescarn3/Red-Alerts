CREATE TABLE Events (
    event_id INT IDENTITY(1,1) PRIMARY KEY,   -- Auto-increment primary key
    id VARCHAR(50) UNIQUE NOT NULL,           -- Unique identifier from the event object
    category VARCHAR(50),                     -- Category (e.g., "1")
    title VARCHAR(255),                       -- Event title
    description VARCHAR(500),                 -- Event description
    event_time DATETIME                       -- Time of the event
);

CREATE TABLE Locations (
    location_id INT IDENTITY(1,1) PRIMARY KEY,  -- Auto-increment primary key
    location_name VARCHAR(255)                  -- The name of the location
);
CREATE TABLE Event_Location (
    event_id INT,                             -- Foreign key from Events table
    location_id INT,                          -- Foreign key from Locations table
    PRIMARY KEY (event_id, location_id),      -- Composite primary key
    FOREIGN KEY (event_id) REFERENCES Events(event_id),      -- Foreign key constraint
    FOREIGN KEY (location_id) REFERENCES Locations(location_id)  -- Foreign key constraint
);
CREATE TABLE Coordinates (
    coordinate_id INT IDENTITY(1,1) PRIMARY KEY,
    address NVARCHAR(255) NOT NULL,
    lat FLOAT NOT NULL,
    lon FLOAT NOT NULL
);


ALTER TABLE Events
ADD id VARCHAR(50) UNIQUE;

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

    -- Step 1: Check if the event already exists (based on id)
    IF EXISTS (
        SELECT 1 
        FROM Events 
        WHERE id = @id
    )
    BEGIN
        PRINT 'Event already exists.';
        RETURN;
    END

    -- Step 2: Insert new event
    DECLARE @event_id INT;
    INSERT INTO Events (id, category, title, description, event_time)
    VALUES (@id, @category, @title, @description, @event_time);

    SET @event_id = SCOPE_IDENTITY();  -- Capture the newly inserted event_id
    PRINT 'Inserted new event with event_id: ' + CAST(@event_id AS VARCHAR(10));

    -- Step 3: Use OPENJSON to parse JSON locations and insert them
    DECLARE @location NVARCHAR(255);
    DECLARE @location_id INT;

    -- Use OPENJSON to parse the JSON array and return a table
    DECLARE @jsonLocations TABLE (location NVARCHAR(255));

    INSERT INTO @jsonLocations (location)
    SELECT value
    FROM OPENJSON(@locations);

    -- Loop through the locations
    DECLARE location_cursor CURSOR FOR
    SELECT location FROM @jsonLocations;

    OPEN location_cursor;
    FETCH NEXT FROM location_cursor INTO @location;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        PRINT 'Processing location: ' + @location;

        -- Step 4: Check if the location already exists
        IF NOT EXISTS (
            SELECT 1 
            FROM Locations 
            WHERE location_name = @location
        )
        BEGIN
            -- Insert new location if it doesn't exist
            INSERT INTO Locations (location_name)
            VALUES (@location);

            SET @location_id = SCOPE_IDENTITY();  -- Capture the new location_id
            PRINT 'Inserted new location with location_id: ' + CAST(@location_id AS VARCHAR(10));
        END
        ELSE
        BEGIN
            -- Get the existing location_id
            SELECT @location_id = location_id
            FROM Locations
            WHERE location_name = @location;
            PRINT 'Found existing location with location_id: ' + CAST(@location_id AS VARCHAR(10));
        END

        -- Step 5: Insert into Event_Location table
        IF NOT EXISTS (
            SELECT 1 
            FROM Event_Location 
            WHERE event_id = @event_id AND location_id = @location_id
        )
        BEGIN
            INSERT INTO Event_Location (event_id, location_id)
            VALUES (@event_id, @location_id);
            PRINT 'Inserted event-location link: event_id = ' + CAST(@event_id AS VARCHAR(10)) + ', location_id = ' + CAST(@location_id AS VARCHAR(10));
        END

        -- Fetch the next location
        FETCH NEXT FROM location_cursor INTO @location;
    END

    CLOSE location_cursor;
    DEALLOCATE location_cursor;

    PRINT 'Event and locations successfully inserted.';
END


EXEC sp_change_users_login 'Auto_Fix', 'RedAlerts';
SELECT name 
FROM sys.sql_logins 
WHERE name = 'RedAlerts';
CREATE LOGIN RedAlerts WITH PASSWORD = 'AlertsRed';
CREATE USER RedAlerts FOR LOGIN RedAlerts;
USE RedAlerts;
ALTER ROLE db_owner ADD MEMBER RedAlerts;
--
Delete Event_Location
Delete Events
Delete Locations
Delete Coordinates

select * from Events
select * from Locations
select * from Event_Location
select * from Coordinates order by Coordinates.address

EXEC AddNewEvent
    @id = '3967',
    @category = '1',
    @title = 'test',
    @description = 'היכנסו למרחב המוגן ושהו בו 10 דקות',
    @event_time = '2024-10-02T00:21:00',
    @locations = N'["שומרה","עכו"]';


DECLARE @locations NVARCHAR(MAX) = N'["שומרה"]';

-- Test how SQL Server parses the JSON
SELECT JSON_VALUE(@locations, '$[0]') AS FirstLocation;

CREATE PROCEDURE GetEventsByDate
    @input_date DATE
AS
BEGIN
    SET NOCOUNT ON;

    -- Convert @input_date to DATETIME to handle time zone calculations
    DECLARE @start_datetime DATETIME = DATEADD(HOUR, -3, CAST(@input_date AS DATETIME));  -- Start from midnight Israel time in UTC
    DECLARE @end_datetime DATETIME = DATEADD(HOUR, 21, CAST(@input_date AS DATETIME));    -- End of day Israel time in UTC

    -- Select events that occurred between the adjusted date range
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
        ) AS data, -- Return locations as a JSON array
        E.description AS [desc],
        E.event_time AS [time]
    FROM Events E
    WHERE E.event_time BETWEEN @start_datetime AND @end_datetime
    FOR JSON PATH, ROOT('events');
END;





CREATE PROCEDURE InsertOrUpdateCoordinates
    @address NVARCHAR(255),
    @lat FLOAT,
    @lon FLOAT
AS
BEGIN
    SET NOCOUNT ON;

    -- Check if the address already exists
    IF EXISTS (SELECT 1 FROM Coordinates WHERE address = @address)
    BEGIN
        -- Update the coordinates if they already exist
        UPDATE Coordinates
        SET lat = @lat, lon = @lon
        WHERE address = @address;
    END
    ELSE
    BEGIN
        -- Insert new address and coordinates if it does not exist
        INSERT INTO Coordinates (address, lat, lon)
        VALUES (@address, @lat, @lon);
    END
END;

--CREATE PROCEDURE GetAllCoordinates
--AS
--BEGIN
--    SET NOCOUNT ON;

    -- Select all the coordinates and addresses
--    SELECT 
--        address,
--        lat,
--        lon
--    FROM Coordinates;
--END;
CREATE PROCEDURE GetCoordinatesByEventDate
    @input_date DATE
AS
BEGIN
    SET NOCOUNT ON;

    -- Convert @input_date to DATETIME to handle time zone calculations
    DECLARE @start_datetime DATETIME = DATEADD(HOUR, -3, CAST(@input_date AS DATETIME));  -- Start from midnight Israel time in UTC
    DECLARE @end_datetime DATETIME = DATEADD(HOUR, 21, CAST(@input_date AS DATETIME));    -- End of day Israel time in UTC

    -- Select the address and coordinates from the Coordinates table
    -- and make sure even locations without coordinates are included
    SELECT DISTINCT
        L.location_name AS address, -- Take location names from the Events
        C.lat,
        C.lon
    FROM Event_Location EL
    JOIN Locations L ON EL.location_id = L.location_id  -- Ensure we get all locations
    LEFT JOIN Coordinates C ON L.location_name = C.address  -- Left join to include missing coordinates
    JOIN Events E ON EL.event_id = E.event_id
    WHERE E.event_time BETWEEN @start_datetime AND @end_datetime
    FOR JSON PATH, ROOT('coordinates');
END;



EXEC GetEventsByDate '2024-10-08'
SELECT * FROM Events
WHERE CAST(event_time AS DATE) = '2024-10-08';

SELECT *
FROM Events
WHERE event_time BETWEEN '2024-10-07T21:00:00' AND '2024-10-08T21:00:00';
exec GetCoordinatesByEventDate '2024-10-08'