/** OpenTelemetry env defaults for AWS ECS (M5 #50). SDK export lands in app code; hooks are stable. */
export const OTEL_PROPAGATORS = 'tracecontext,baggage' as const;
export const OTEL_TRACES_SAMPLER = 'parentbased_traceidratio' as const;
export const OTEL_TRACES_SAMPLER_ARG = '0.1' as const;

export type AwsDeploymentProfile = 'aws-baseline' | 'aws-optimized';

export function buildOtelResourceAttributes(
  runId: string,
  profile: AwsDeploymentProfile,
): string {
  return `service.namespace=railflux,run_id=${runId},deployment.profile=${profile}`;
}

export function buildAwsOtelProcessEnv(
  runId: string,
  profile: AwsDeploymentProfile,
): Record<string, string> {
  return {
    OTEL_RESOURCE_ATTRIBUTES: buildOtelResourceAttributes(runId, profile),
    OTEL_PROPAGATORS,
    OTEL_TRACES_SAMPLER,
    OTEL_TRACES_SAMPLER_ARG,
  };
}
