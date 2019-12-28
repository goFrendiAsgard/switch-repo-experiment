const config = {
    "environments": {
        "general": { // works for all services
            "nats-url": "nats://nats.io:4222",
        },
        "services": {
            "gateway": { // only work for gateway
                "port": 3000,
            }
        }
    },
    "libraries": { // services might share some code base here
        "nats-lib": {
            "location": "libraries/nats"
        }
    },
    "services": {
        "gateway": {
            "type": "repo",
            "origin": "git@github.com:goFrendiAsgard/switch-repo-gateway.git",
            "branch": "master",
            "location": "services/gateway",
            "libraries": {
                "nats-lib": "services/gateway/nats-lib"
            },
            "start": "npm install && node start",
        },
        "service": {
            "type": "repo",
            "origin": "git@github.com:goFrendiAsgard/switch-repo-service.git",
            "branch": "master",
            "location": "services/service",
            "libraries": {
                "nats-lib": "services/gateway/nats-lib"
            },
            "start": "npm install && node start",
        },
        "nats": {
            "type": "container",
            "run": "docker run --name nats -p 4222:4222 -p 6222:6222 -p 8222:8222 -d nats",
            "start": "docker start nats",
        }
    },
    "executions": [
        "nats",
        "service",
        "gateway",
    ],
}