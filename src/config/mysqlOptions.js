export const getMysqlOptions = () => ({
    host: process.env.MYSQL_IP,
    port: 3306,
    user: "root",
    password: process.env.MYSQL_PASSWORD,
    database: "default",
    connectionLimit: 10,
});
