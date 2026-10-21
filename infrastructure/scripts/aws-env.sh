#!/usr/bin/env bash
# RailFlux AWS CLI defaults — source from cfn-lib.sh (not for direct execution).
# Fixes: wrong [default] profile, wrong region, Cursor sandbox proxy breaking aws cli.

RAILFLUX_AWS_PROFILE="${RAILFLUX_AWS_PROFILE:-railflux}"

if [[ -z "${AWS_PROFILE:-}" ]]; then
  export AWS_PROFILE="${RAILFLUX_AWS_PROFILE}"
fi

export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-${RAILFLUX_APP_REGION:-ap-south-1}}"

# Cursor agent shells sometimes inject a local HTTP proxy; AWS CLI then fails with
# "Failed to connect to proxy URL: http://127.0.0.1:...".
case "${http_proxy:-}${HTTP_PROXY:-}" in
  *127.0.0.1*)
    unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY ALL_PROXY all_proxy
    ;;
esac
