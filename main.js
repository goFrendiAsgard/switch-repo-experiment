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

function runCommand(command, option) {
    // create `proc` and make `promise` to wait until the `proc` closed.
    const proc = spawn("/bin/bash", ["-c", command], option);
    proc.stdout.on("data", (data) => {
        const strData = data.toString("utf8");
        process.stdout.write(strData);
    });
    proc.stderr.on("data", (data) => {
        const strData = data.toString("utf8");
        process.stderr.write(strData);
    });
    const promise = new Promise((resolve, reject) => {
        try {
            proc.on("close", (code) => {
                resolve(code);
            });
        } catch (error) {
            reject(error);
        }
    })
    return promise;
}

/**
 * pull all repo and libraries
 * @param {Config} config - configuration
 */
async function pull(config) {
    for (let componentName in config.components) {
        const component = config.components[componentName];
        if (["repo", "library"].indexOf(component.type) == -1) {
            continue;
        }
        if (component.origin == "" || component.location == "") {
            continue;
        }
        if (component.branch == "") {
            component.branch = "master";
        }
        const cwd = component.location;
        console.log(`[PULL ${componentName}]`);
        try {
            await runCommand("git add . -A && git commit -m 'Save changes'", { cwd });
            await runCommand(`git fetch && git checkout HEAD && git pull origin HEAD`, { cwd });
        } catch (error) {
            await runCommand(`git clone ${component.origin} ${component.location} && git checkout -b ${component.branch}`, { cwd });
        }
    }
    console.log(`[PULL MONOREPO]`);
    await runCommand("git add . -A && git commit -m 'Save changes'");
    await runCommand(`git fetch && git checkout HEAD && git pull origin HEAD`);
}

/**
 * push all repo and libraries 
 * @param {Config} config - configuration
 */
async function push(config) {
    for (let componentName in config.components) {
        const component = config.components[componentName];
        if (["repo", "library"].indexOf(component.type) == -1) {
            continue;
        }
        if (component.origin == "" || component.location == "") {
            continue;
        }
        const cwd = component.location;
        console.log(`[PUSH ${componentName}]`);
        await runCommand("git add . -A && git commit -m 'Save changes before push to remote' && git push -u origin HEAD", { cwd });
    }
    console.log(`[PUSH MONOREPO]`);
    await runCommand("git add . -A && git commit -m 'Save changes before push to remote' && git push -u origin HEAD");
}

/**
 * run command of a component
 * @param {string} serviceName - Name of the service (i.e: how the command is aliased)
 * @param {string} command  - The command
 * @param {Config} config - configuration
 */
function runComponentCommand(serviceName, command, config) {
    const cwd = config.components[serviceName].location;
    const env = {};
    for (let key in process.env) {
        env[key] = process.env[key];
    }
    for (let key in config.environments.general) {
        env[key] = config.environments.general[key];
    }
    for (let key in config.environments.services[serviceName]) {
        env[key] = config.environments.services[serviceName][key];
    }
    // create `proc` and make `promise` to wait until the `proc` closed.
    const proc = spawn("/bin/bash", ["-c", command], { cwd, env });
    proc.stdout.on("data", (data) => {
        const strData = data.toString("utf8");
        const utcString = new Date().toISOString();
        process.stdout.write(`[LOG ${utcString} ${serviceName}] ${strData}`);
    });
    proc.stderr.on("data", (data) => {
        const strData = data.toString("utf8");
        const utcString = new Date().toISOString();
        process.stderr.write(`[ERR ${utcString} ${serviceName}] ${strData}`);
    });
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
 * run repo component
 * @param {string} serviceName - Name of the service (i.e: how the command is aliased)
 * @param {Repo} component - component
 * @param {Config} config - config
 */
function runRepoComponent(serviceName, component, config) {
    const command = component.start;
    return runComponentCommand(serviceName, command, config);
}

/**
 * run container component
 * @param {string} serviceName - Name of the service (i.e: how the command is aliased)
 * @param {Container} component - component
 * @param {Config} config - config
 */
function runContainerComponent(serviceName, component, config) {
    const command = `${component.start} || ${component.run}`;
    return runComponentCommand(serviceName, command, config);
}

/**
 * get runner for component
 * @param {Repo | Container | Library} component  - component
 */
function getComponentRunner(component) {
    switch (component.type) {
        case "container": return runContainerComponent;
        case "repo": return runRepoComponent;
        default: return runRepoComponent;
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
    for (let serviceName of config.executions) {
        const component = config.components[serviceName];
        if (["repo", "container"].indexOf(component.type) == -1) {
            continue;
        }
        const runner = getComponentRunner(component);
        const { promise, proc } = runner(serviceName, component, config);
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