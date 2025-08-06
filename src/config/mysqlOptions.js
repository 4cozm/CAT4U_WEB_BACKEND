export const getMysqlOptions = () => ({
    host: process.env.MYSQL_HOST,
    user: 'root',
    password: process.env.MYSQL_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});
