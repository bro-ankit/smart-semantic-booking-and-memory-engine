export const ENV_VARIABLES = {
    DATABASE: {
        host: "DB_HOST",
        port: "DB_PORT",
        user: "DB_USER",
        password: "DB_PASSWORD",
        database: "DB_NAME",
        poolSize: "DB_POOL_SIZE",
    },
    GEMINI: {
        API_KEY: "GEMINI_API_KEY"
    },
    SERVER: {
        PORT: 'SERVER_PORT'
    },
    REDIS: {
        HOST: 'REDIS_HOST',
        PORT: 'REDIS_PORT',
    },
} as const