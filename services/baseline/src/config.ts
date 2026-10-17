export type ServiceConfig = {
  nodeEnv: string;
  port: number;
  profile: 'baseline';
  mysql: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  };
};

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServiceConfig {
  return {
    nodeEnv: env.NODE_ENV ?? 'development',
    port: Number(env.PORT ?? '3000'),
    profile: 'baseline',
    mysql: {
      host: env.MYSQL_HOST ?? '127.0.0.1',
      port: Number(env.MYSQL_PORT ?? '3306'),
      user: required('MYSQL_USER', env.MYSQL_USER),
      password: required('MYSQL_PASSWORD', env.MYSQL_PASSWORD),
      database: required('MYSQL_DATABASE', env.MYSQL_DATABASE),
    },
  };
}
