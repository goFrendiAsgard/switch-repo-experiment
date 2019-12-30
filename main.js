const configuration = require("./configuration.js");
const { spawn } = require('child_process');

/**
 * @typedef {Object} Environments
 * @property {Map<string, string>} general - General environment
 * @property {Map<string, Map<string, string>} services - Per-service environment
 * 
 * @typedef {Object} Repo
 * @property {string} type - Component type to indicate that this is a `repo` should be "repo"
 * @property {string} location - Location of the repo relative to current directory
 * @property {string} start - Command to run repo in local machine
 * @property {Map<string, string>} link - link from library's location to this repo
 * @property {string} origin - Origin of the repo
 * @property {string} branch - Repo branch (used for pull/clone)
 * 
 * @typedef {Object} Library
 * @property {string} type - Component type to indicate that this is a `library` should be "library"
 * @property {string} location - Location of the library relative to current directory
 * @property {Map<string, string>} link - link from other library's location to this repo
 * @property {string} origin - Origin of the repo
 * @property {string} branch - Repo branch (used for pull/clone)
 * 
 * @typedef {Object} Container
 * @property {string} type - Component type to indicate that this is a `container` should be "container"
 * @property {string} location - Location of the repo relative to current directory
 * @property {string} start - Command to run repo in local machine
 * @property {string} run - Command to run repo in local machine (will be executed if `start` is failed)
 * @property {Map<string, string>} link - link from library's location to this repo
 * 
 * @typedef {Object} Config
 * @property {Environments} environments - Environments for each services.
 * @property {Map<string, Repo | Library | Container>} components - Components.
 * @property {string[]} executions - Components execution order.
 */

/**
 * runCommand run a command
 * @param {string} serviceName - Name of the service (i.e: how the command is aliased)
 * @param {string} command  - The command
 * @param {Environments} environments - Environments
 */
function runCommand(serviceName, command, environments) {
    const flattenEnv = {};
    for (let key in environments.general) {
        flattenEnv[key] = environments.general[key];
    }
    for (let key in environments.services[serviceName]) {
        flattenEnv[key] = environments.services[serviceName][key];
    }
    // create `proc` and make `promise` to wait until the `proc` closed.
    const proc = spawn("/bin/bash", ["-c", command], flattenEnv);
    proc.stdout.on("data", (data) => {
        console.log(serviceName + " " + data.toString("utf8"));
    });
    proc.stderr.on("data", (data) => {
        console.log(serviceName + " " + data.toString("utf8"));
    })
    const promise = new Promise((resolve, reject) => {
        try {
            proc.on("close", (code) => {
                resolve(code);
            });
        } catch (error) {
            reject(error);
        }
    })
    return { promise, proc };
}


/**
 * pull all `component` in config that has `repo` type
 * @param {Config} config - configuration
 */
async function pull(config) {
    console.log("pull", config);
}

/**
 * push all `component` in config that has `repo` type 
 * @param {Config} config - configuration
 */
async function push(config) {
    console.log("push", config);
}

/**
 * run service `component` in config that has `repo` type 
 * @param {string} serviceName - Name of the service (i.e: how the command is aliased)
 * @param {Repo} component - component
 * @param {Environments} environments - Environments
 */
function runService(serviceName, component, environments) {
    const command = component.start;
    return runCommand(serviceName, command, environments);
}

/**
 * run service `component` in config that has `container` type 
 * @param {string} serviceName - Name of the service (i.e: how the command is aliased)
 * @param {Container} component - component
 * @param {Environments} environments - Environments
 */
function runContainer(serviceName, component, environments) {
    const command = `${component.start} || ${component.run}`;
    return runCommand(serviceName, command, environments);
}

/**
 * 
 * @param {Repo | Container | Library} component  - component
 */
function getRunner(component) {
    switch (component.type) {
        case "container": return runContainer;
        case "repo": return runService;
        default: return runService;
    }
}

/**
 * run all `component` in config
 * @param {Config} config - configuration
 */
async function run(config) {
    const procs = [];
    const promises = [];
    // add controller (i.e: to terminate all process when ctrl+c is executed)
    const pControl = new Promise((resolve, reject) => {
        process.on("SIGINT", () => {
            console.log("Terminating all process...");
            try {
                for (proc of procs) {
                    proc.kill();
                }
            } catch (error) {
                reject(error);
            }
            console.log("All process terminated...");
            return resolve(true);
        });
    });
    promises.push(pControl);
    // add all service processes
    const environments = config.environments;
    for (let serviceName of config.executions) {
        const component = config.components[serviceName];
        if (["repo", "container"].indexOf(component.type) == -1) {
            continue;
        }
        const runner = getRunner(component);
        const { promise, proc } = runner(serviceName, component, environments);
        promises.push(promise);
        procs.push(proc)
    }
    // wait
    await Promise.all(promises);
}

async function main() {
    const config = configuration.config;
    const args = process.argv.slice(2);
    const command = args[0];
    switch (command) {
        case "pull": await pull(config); break;
        case "push": await push(config); break;
        case "run": await run(config); break;
        default: console.log("invalid command");
    }
    return true;
}

main().then((val) => {
    console.log("Done", val);
}).catch((error) => {
    console.error(error);
});