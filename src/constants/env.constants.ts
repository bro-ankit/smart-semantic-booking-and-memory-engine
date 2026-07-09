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
        API_KEY: "GEMINI_API_KEY",
        COST_INPUT_PER_MILLION: "GEMINI_COST_INPUT_PER_MILLION",
        COST_OUTPUT_PER_MILLION: "GEMINI_COST_OUTPUT_PER_MILLION",
    },
    SERVER: {
        PORT: 'SERVER_PORT'
    },
    REDIS: {
        HOST: 'REDIS_HOST',
        PORT: 'REDIS_PORT',
    },
} as const