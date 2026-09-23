import { join } from "path"
import { logger } from "../core/helpers/logger"

interface SyncStep {
    name: string
    script: string
}

const jobsDir = import.meta.dir

const steps: SyncStep[] = [
    {
        name: "sync:branch",
        script: join(jobsDir, "sync-branch.job.ts"),
    },
    {
        name: "sync:organization",
        script: join(jobsDir, "sync-organization.job.ts"),
    },
    {
        name: "sync:employee",
        script: join(jobsDir, "sync-employee.job.ts"),
    },
    {
        name: "sync:user",
        script: join(jobsDir, "sync-user.job.ts"),
    },
]

async function runStep(step: SyncStep, stepIndex: number, totalSteps: number) {
    logger.info("------------------------------------------------------------")
    logger.info(`[${stepIndex}/${totalSteps}] Running ${step.name}...`)
    logger.info("------------------------------------------------------------")

    const stepStart = Date.now()

    const proc = Bun.spawn(["bun", "run", step.script], {
        stdout: "inherit",
        stderr: "inherit",
        env: process.env,
    })

    const exitCode = await proc.exited

    if (exitCode !== 0) {
        throw new Error(`Step ${step.name} failed with exit code ${exitCode}`)
    }

    const duration = ((Date.now() - stepStart) / 1000).toFixed(2)
    logger.info(`[${stepIndex}/${totalSteps}] ${step.name} finished successfully in ${duration}s`)
}

async function run() {
    const totalStart = Date.now()
    logger.info("Starting sequential Nusawork sync (branch -> organization -> employee -> user)...")

    try {
        for (let i = 0; i < steps.length; i++) {
            await runStep(steps[i], i + 1, steps.length)
        }

        const totalDuration = ((Date.now() - totalStart) / 1000).toFixed(2)
        logger.info("============================================================")
        logger.info(`Nusawork sequential sync finished successfully in ${totalDuration}s.`)
        logger.info("============================================================")
        process.exit(0)
    } catch (error: any) {
        logger.error(`Nusawork sync aborted: ${error?.message || error}`)
        process.exit(1)
    }
}

run()
