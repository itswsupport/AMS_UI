pipeline {
  agent any

  triggers {
    githubPush()
  }

  environment {
    RECIPIENTS = 'ruchatest4@gmail.com'
    CONTAINER_NAME = 'ui-ams'
    IMAGE_NAME = 'ams-ui'
    TAG = "${env.BUILD_NUMBER}"

    // Host port published for the container's Next server (3000 inside). Must not clash
    // with the TMS UI (3022) or anything else on the server — the Deploy preflight below
    // fails the build rather than take over a port that is already in use.
    HOST_PORT = '3023'

    // The app serves from the ROOT: next.config.mjs has no basePath. Pages are checked
    // with a trailing slash because next.config.mjs sets trailingSlash: true — /Login is a
    // 308 and only /Login/ answers 200.
    LOGIN_PAGE = '/Login/'

    // What the browser calls (relative, same-origin) — the default in src/config/api.js.
    // The Next rewrite proxies it to the backend and strips the /api prefix:
    //   /api/device/list/  ->  ams-backend:8080/device/list/
    API_BASE_PATH = '/api'

    // The AMS Spring backend (Asset-Tracking-System) as seen from INSIDE the UI container:
    //   ams-backend  the backend's container name — must match its own deploy
    //   8080         the port INSIDE that container (it sets no server.port, so Spring's
    //                default), NOT the host port it may be published on
    // No context path and no trailing slash. Baked in at BUILD time (frozen into
    // .next/routes-manifest.json), so changing it is a rebuild, not a restart.
    BACKEND_ORIGIN = 'http://ams-backend:8080'

    // Both containers join this network so 'ams-backend' resolves; the default bridge has
    // no container-name DNS. Whichever pipeline runs first creates it.
    DOCKER_NETWORK = 'ams-net'

    // Trivy configuration
    TRIVY_SEVERITY = 'CRITICAL,HIGH'
    TRIVY_EXIT_CODE = '0'             // Set to '1' to fail build on vulnerabilities
  }

  options {
    timeout(time: 45, unit: 'MINUTES')
    timestamps()
    // Two builds deploying at once would race over the same container name and port.
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '15'))
  }

  stages {
    stage('Checkout Code') {
      steps {
        git(
          url: 'https://github.com/itswsupport/AMS_UI.git',
          branch: 'main',
          credentialsId: 'ui-payroll'
        )
        script {
          env.GIT_SHA = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
        }
        echo "Building ${env.IMAGE_NAME}:${env.TAG} from ${env.GIT_SHA}"
        echo "Backend: ${env.BACKEND_ORIGIN}  API: ${env.API_BASE_PATH}"
      }
    }

    stage('Build') {
      // --target builder stops at the Next compile, so a broken build fails here. Same
      // build args as Package: they are consumed by `npm run build`, which runs in this
      // stage, and Package then reuses these cached layers.
      //
      // NEXT_PUBLIC_MOCK_AUTH=false keeps the demo logins (admin/admin...) out of the live
      // build — see the Dockerfile and the check in Verify Build.
      steps {
        sh '''
          docker build \
            --target builder \
            --build-arg BACKEND_URL=${BACKEND_ORIGIN} \
            --build-arg NEXT_PUBLIC_API_BASE_URL=${API_BASE_PATH} \
            --build-arg NEXT_PUBLIC_MOCK_AUTH=false \
            --build-arg NEXT_PUBLIC_LOGIN_MODE=local \
            -t ${IMAGE_NAME}:builder-${TAG} \
            .
        '''
      }
    }

    stage('Lint') {
      // Inside the builder image, so the agent needs no Node of its own. Report-only:
      // next.config.mjs ignores ESLint during builds, so lint has never gated this code.
      steps {
        sh 'docker run --rm ${IMAGE_NAME}:builder-${TAG} npm run lint || true'
      }
    }

    stage('OWASP Dependency Check') {
      steps {
        dependencyCheck additionalArguments: '''
          --scan .
          --format HTML
          --format XML
          --out .
          --prettyPrint
        ''', odcInstallation: 'Dependency-Check'

        dependencyCheckPublisher pattern: 'dependency-check-report.xml'
      }
    }

    stage('Package') {
      // Same build args again; the npm ci and compile layers are reused from Build.
      steps {
        sh '''
          docker build \
            --build-arg BACKEND_URL=${BACKEND_ORIGIN} \
            --build-arg NEXT_PUBLIC_API_BASE_URL=${API_BASE_PATH} \
            --build-arg NEXT_PUBLIC_MOCK_AUTH=false \
            --build-arg NEXT_PUBLIC_LOGIN_MODE=local \
            -t ${IMAGE_NAME}:latest -t ${IMAGE_NAME}:${TAG} .
        '''
      }
    }

    stage('Verify Build') {
      // Everything above is baked in at build time, so check it actually landed in the
      // image before deploying it:
      //   server.js              the standalone entry point the container runs
      //   rewrite destination    the /api proxy, frozen into routes-manifest.json — a wrong
      //                          BACKEND_ORIGIN can only be fixed by rebuilding
      steps {
        sh '''
          docker run --rm --entrypoint node ${IMAGE_NAME}:${TAG} -e "
            const fs = require('fs');
            if (!fs.existsSync('/app/server.js')) {
              console.error('server.js is missing — the standalone build did not land in the image');
              process.exit(1);
            }
            const m = require('/app/.next/routes-manifest.json');
            const rw = m.rewrites || [];
            const all = Array.isArray(rw) ? rw : [].concat(rw.beforeFiles || [], rw.afterFiles || [], rw.fallback || []);
            const proxy = all.find(r => (r.destination || '').startsWith('${BACKEND_ORIGIN}'));
            if (!proxy) {
              console.error('no rewrite points at ${BACKEND_ORIGIN} — found: ' + JSON.stringify(all.map(r => r.destination)));
              process.exit(1);
            }
            if (!proxy.source.startsWith('${API_BASE_PATH}')) {
              console.error('rewrite source is ' + proxy.source + ', expected it to start with ${API_BASE_PATH}');
              process.exit(1);
            }
            console.log('manifest OK: proxy ' + proxy.source + ' -> ' + proxy.destination);
          "

          # DEMO LOGINS MUST BE OFF. The flag is inlined into the client bundle, where
          # src/lib/mockAuth.js compiles to "<x>=!1,<y>={admin:{user_id:"admin"..." when it is
          # off and "=!0,..." when it is on (the demo-account list sits right after the flag).
          # The login page's HTML cannot be used for this: the demo panel is drawn in the
          # browser, so it is missing from the server HTML whether the flag is on or off.
          #
          # Both directions are asserted. Requiring the OFF marker means a future Next or
          # minifier change that reshapes this code fails the build loudly instead of letting
          # the check pass on nothing.
          ON='=!0,[A-Za-z0-9_$]+=[{]admin:[{]user_id:"admin"'
          OFF='=!1,[A-Za-z0-9_$]+=[{]admin:[{]user_id:"admin"'
          if docker run --rm --entrypoint grep ${IMAGE_NAME}:${TAG} -rqE "$ON" /app/.next/static/chunks; then
            echo "ERROR: demo logins are ON in this image (admin/admin would work) — NEXT_PUBLIC_MOCK_AUTH must be false"
            exit 1
          fi
          if ! docker run --rm --entrypoint grep ${IMAGE_NAME}:${TAG} -rqE "$OFF" /app/.next/static/chunks; then
            echo "ERROR: could not confirm demo logins are off — the compiled mockAuth flag was not found."
            echo "The bundle shape may have changed; re-check this pattern against .next/static/chunks."
            exit 1
          fi
          echo "demo logins OFF in the bundle"
        '''
      }
    }

    stage('Trivy FS Scan') {
      steps {
        script {
          echo "Running Trivy Filesystem Scan for vulnerabilities..."
          sh '''
            trivy fs --format table \
              --severity ${TRIVY_SEVERITY} \
              --exit-code ${TRIVY_EXIT_CODE} \
              --scanners vuln,secret,misconfig \
              . > trivy-fs-report.txt 2>&1 || true

            trivy fs --format json \
              --severity ${TRIVY_SEVERITY} \
              --output trivy-fs-report.json \
              --scanners vuln,secret,misconfig \
              . || true

            echo "=== Trivy FS Scan Results ==="
            cat trivy-fs-report.txt
          '''
        }
      }
    }

    stage('Trivy Image Scan') {
      steps {
        script {
          echo "Running Trivy Image Scan for vulnerabilities..."
          sh '''
            trivy image --format table \
              --severity ${TRIVY_SEVERITY} \
              --exit-code ${TRIVY_EXIT_CODE} \
              --scanners vuln \
              ${IMAGE_NAME}:${BUILD_NUMBER} > trivy-image-report.txt 2>&1 || true

            trivy image --format json \
              --severity ${TRIVY_SEVERITY} \
              --output trivy-image-report.json \
              --scanners vuln \
              ${IMAGE_NAME}:${BUILD_NUMBER} || true

            trivy image --format template \
              --template "@/usr/share/trivy/templates/html.tpl" \
              --severity ${TRIVY_SEVERITY} \
              --output trivy-image-report.html \
              ${IMAGE_NAME}:${BUILD_NUMBER} || true

            echo "=== Trivy Image Scan Results ==="
            cat trivy-image-report.txt
          '''
        }
      }
    }

    stage('Trivy Scan Quality Gate') {
      steps {
        script {
          echo "Checking for CRITICAL vulnerabilities..."
          def criticalVulns = sh(
            script: '''
              COUNT=$(trivy image --format json \
                --severity CRITICAL \
                --scanners vuln \
                ${IMAGE_NAME}:${BUILD_NUMBER} 2>/dev/null | \
                grep -c '"Severity": "CRITICAL"' || true)
              echo "${COUNT:-0}"
            ''',
            returnStdout: true
          ).trim()

          def vulnCount = criticalVulns.isInteger() ? criticalVulns.toInteger() : 0

          if (vulnCount > 0) {
            echo "WARNING: Found ${vulnCount} CRITICAL vulnerabilities!"
          } else {
            echo "No CRITICAL vulnerabilities found."
          }
        }
      }
    }

    stage('Deploy') {
      steps {
        sh '''
          set -e

          # Preflight: fail the build, rather than take the site down, if the port belongs
          # to some other container or to a process outside Docker.
          OTHERS=$(docker ps --filter "publish=${HOST_PORT}" --format '{{.Names}}' | grep -vx "${CONTAINER_NAME}" || true)
          if [ -n "$OTHERS" ]; then
            echo "port ${HOST_PORT} is already published by container(s): $OTHERS"
            echo "the running ${CONTAINER_NAME} has been left untouched — free that port or pick another HOST_PORT"
            exit 1
          fi

          if [ -z "$(docker ps -q -f name="^${CONTAINER_NAME}$")" ]; then
            if ss -ltn 2>/dev/null | grep -q ":${HOST_PORT} "; then
              echo "port ${HOST_PORT} is held by a process on the host, not by Docker:"
              ss -ltnp 2>/dev/null | grep ":${HOST_PORT} " || true
              exit 1
            fi
          fi

          # Idempotent — the network already exists on every build after the first.
          docker network create ${DOCKER_NETWORK} 2>/dev/null || true

          docker rm -f ${CONTAINER_NAME} || true

          # docker-proxy can hold the binding for a moment after the container goes.
          for i in $(seq 1 15); do
            ss -ltn 2>/dev/null | grep -q ":${HOST_PORT} " || break
            sleep 1
          done

          # The exact tag the stages above verified, not :latest.
          docker run -d --name ${CONTAINER_NAME} \
            --network ${DOCKER_NETWORK} \
            -p ${HOST_PORT}:3000 \
            --restart unless-stopped \
            ${IMAGE_NAME}:${TAG}
        '''
      }
    }

    stage('Health Check') {
      steps {
        script {
          sh '''
            echo "Waiting for container to start..."
            sleep 10

            docker logs ${CONTAINER_NAME} --tail 20 || true

            # Ask docker for the real state: a container that crashes on start is restarted
            # by --restart unless-stopped and would still show up in `docker ps`.
            STATE=$(docker inspect -f '{{.State.Status}}' ${CONTAINER_NAME} 2>/dev/null || echo missing)
            if [ "${STATE}" != "running" ]; then
              echo "ERROR: container state is '${STATE}', expected 'running'"
              docker logs ${CONTAINER_NAME} --tail 50 || true
              exit 1
            fi

            if curl -fsS --retry 5 --retry-delay 3 --retry-connrefused \
                 http://localhost:${HOST_PORT}${LOGIN_PAGE} > /dev/null; then
              echo "Health check passed: http://localhost:${HOST_PORT}${LOGIN_PAGE}"
            else
              echo "ERROR: health check failed against http://localhost:${HOST_PORT}${LOGIN_PAGE}"
              docker logs ${CONTAINER_NAME} --tail 50 || true
              exit 1
            fi

            # Pages being served proves nothing about the API. Exercise the real chain:
            #   Next :3000  ->  /api/device/list/  ->  ams-backend:8080/device/list/
            # device/list is a GET the backend maps with and without the trailing slash.
            # This proves REACHABILITY: a 401/403 from Spring Security still means Spring
            # answered, so it passes.
            #   000 / 5xx  the proxy could not reach ${BACKEND_ORIGIN} — backend down, not
            #              on ${DOCKER_NETWORK}, or wrong port
            #   404        something answered but not this path — wrong context path or route
            API_URL="http://localhost:${HOST_PORT}${API_BASE_PATH}/device/list/"
            API_BODY=$(mktemp)
            CODE=$(curl -s --retry 5 --retry-delay 3 --retry-connrefused \
                     -o "${API_BODY}" -w '%{http_code}' "${API_URL}" || true)
            CODE=${CODE:-000}

            if [ "${CODE}" != "404" ] && [ "${CODE}" != "000" ] && [ "${CODE}" -lt 500 ]; then
              echo "API proxy check passed (HTTP ${CODE}): ${API_BASE_PATH} -> ${BACKEND_ORIGIN}"
              rm -f "${API_BODY}"
            elif [ "${CODE}" = "404" ]; then
              echo "ERROR: ${API_URL} answered HTTP 404 — the proxy reached ${BACKEND_ORIGIN}"
              echo "but the backend does not serve /device/list/. Check its context path is empty."
              echo "--- response body ---"
              head -c 500 "${API_BODY}" || true; echo
              rm -f "${API_BODY}"
              exit 1
            else
              echo "ERROR: ${API_BASE_PATH} did not reach the backend at ${BACKEND_ORIGIN} (HTTP ${CODE})"
              echo "Check that the ams-backend container is running and attached to ${DOCKER_NETWORK}:"
              docker ps -a --filter name=ams-backend --format '{{.Names}} {{.Status}}' || true
              docker network inspect ${DOCKER_NETWORK} --format '{{range .Containers}}{{.Name}} {{end}}' || true
              echo "--- ui log (ECONNREFUSED / getaddrinfo here means the proxy never connected) ---"
              docker logs ${CONTAINER_NAME} --tail 50 2>&1 || true
              rm -f "${API_BODY}"
              exit 1
            fi
          '''
        }
      }
    }

    stage('Verify Page Routing') {
      // A real page other than the one the Health Check already asked for. (The demo-login
      // guard is in Verify Build, before deploy — this page's HTML cannot show it.)
      steps {
        sh '''
          CODE=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:${HOST_PORT}/UserDashboard/)
          if [ "$CODE" != "200" ]; then
            echo "page routing broken: /UserDashboard/ returned $CODE, expected 200"
            exit 1
          fi
          echo "page routing OK"
        '''
      }
    }

    stage('Cleanup Old Images') {
      steps {
        sh '''
          # Keep only last 3 builds
          docker images ${IMAGE_NAME} --format "{{.Tag}}" | grep -E '^[0-9]+$' | sort -rn | tail -n +4 | xargs -r -I {} docker rmi ${IMAGE_NAME}:{}

          # Remove dangling images
          docker image prune -f
        '''
      }
    }
  }

  post {
    success {
      mail to: "${RECIPIENTS}",
           subject: "Jenkins Build SUCCESS: ${env.JOB_NAME} [#${env.BUILD_NUMBER}]",
           body: """
The build was successful!

Job: ${env.JOB_NAME}
Build: ${env.BUILD_URL}
Branch: main
Commit: ${env.GIT_SHA}
Image: ${env.IMAGE_NAME}:${env.TAG}
API base URL: ${env.API_BASE_PATH}
Backend: ${env.BACKEND_ORIGIN}
Status: Deployed and running on port ${env.HOST_PORT}

Security Scans:
- OWASP Dependency Check: Completed
- Trivy Vulnerability Scan: Completed

View Trivy Report: ${env.BUILD_URL}Trivy_Vulnerability_Report/
"""
    }
    failure {
      mail to: "${RECIPIENTS}",
           subject: "Jenkins Build FAILED: ${env.JOB_NAME} [#${env.BUILD_NUMBER}]",
           body: """
The build has failed.

Job: ${env.JOB_NAME}
Build: ${env.BUILD_URL}
Branch: main
Commit: ${env.GIT_SHA}
Status: Failed

Security Scans may have identified issues. Check:
- Trivy Report: ${env.BUILD_URL}Trivy_Vulnerability_Report/
- OWASP Report: ${env.BUILD_URL}artifact/dependency-check-report.html

Please check the console output: ${env.BUILD_URL}console
"""
    }
    always {
      sh 'docker logs ${CONTAINER_NAME} > docker-logs.txt 2>&1 || true'
      archiveArtifacts artifacts: 'docker-logs.txt', allowEmptyArchive: true

      archiveArtifacts artifacts: 'trivy-*.txt, trivy-*.json, trivy-*.html', allowEmptyArchive: true

      publishHTML(target: [
        allowMissing: true,
        alwaysLinkToLastBuild: true,
        keepAll: true,
        reportDir: '.',
        reportFiles: 'trivy-image-report.html',
        reportName: 'Trivy Vulnerability Report'
      ])

      // The builder image carries the whole node_modules tree — don't leave it behind.
      sh 'docker image rm -f ${IMAGE_NAME}:builder-${TAG} || true'
      sh 'docker image prune -f --filter "until=168h" || true'
    }
  }
}
