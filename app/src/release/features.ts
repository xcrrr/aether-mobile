/**
 * Task (the local agent) is complete and stays under test in `src/agent/`, but it
 * is not part of the shipped MVP: the product surfaces Chat, Core and Research
 * only. This flag controls visibility, never the kernel — flip it to dogfood Task
 * on a local build without branching the repo.
 */
export const TASK_UI_ENABLED = false;
