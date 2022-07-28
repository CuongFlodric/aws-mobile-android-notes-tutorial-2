const AWS = require("aws-sdk")
const { assert } = require("console")

const REGION = "ap-southeast-1"

/* Utils */
const Utils = {
    assert: require("assert"),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    test: async () => {
        console.log("hi")
        await Utils.sleep(2000)
        console.log("hi")
        Utils.assert(true)
        // Utils.assert(false)
    },
    logBuild: (build) => {
        const { id, buildStatus, buildComplete, startTime, endTime, artifacts } = build
        console.log({ id, buildStatus, buildComplete, startTime, endTime, artifacts })
    },
}

AWS.config = new AWS.Config()
AWS.config.region = REGION
let codebuild = new AWS.CodeBuild()
// AWS.config.credentials = new AWS.Credentials(ACCESS_KEY, SECRET_KEY);

function listProjects() {
    return new Promise((resolve, reject) => {
        codebuild.listProjects((err, data) => {
            if (err) reject(err)
            else resolve(data.projects)
        })
    })
}

async function getBuild(buildId) {
    let builds = await _batchGetBuilds([buildId])
    return builds[0]
}

function _batchGetBuilds(idList) {
    let param = {
        ids: idList,
    }
    return new Promise((resolve, reject) => {
        codebuild.batchGetBuilds(param, (err, data) => {
            if (err) reject(err)
            else resolve(data.builds)
        })
    })
}

function startBuild(projectName) {
    listProjects().then((projects) => {
        if (!projects.includes(projectName)) {
            throw Exception("No such projectName: " + projectName)
        }
    })

    let param = {
        projectName: projectName,
    }
    return new Promise((resolve, reject) => {
        codebuild.startBuild(param, (err, data) => {
            if (err) reject(err)
            else resolve(data.build)
        })
    })
}

async function poll_until_build_success(buildId, timeOutSeconds = 100) {
    let buildSucceeded = false
    let counter = 0
    while (counter < timeOutSeconds) {
        const { buildStatus } = await getBuild(buildId)
        console.log({ buildStatus })
        if (buildStatus == "SUCCEEDED") {
            return
        } else if (["FAILED", "FAULT", "STOPPED", "TIMED_OUT"].includes(buildStatus)) {
            throw Exception("Test failed")
        }
        counter += 60
        await Utils.sleep(60000)
    }
    throw Exception("Timeout")
}

async function execute() {
    const FALLBACK_PROJECT = "dev-user"
    let projectName = process.env.projectName || FALLBACK_PROJECT

    const buildId = (await startBuild(projectName)).id
    console.log({ projectName })
    console.log({ buildId })
    try {
        await poll_until_build_success(buildId, 60 * 10)
        Utils.logBuild(await getBuild(buildId))
    } catch (e) {
        console.error(e)
        Utils.assert(false, "Build failed")
    }
}

execute().catch(console.error)
