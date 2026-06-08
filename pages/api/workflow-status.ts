import type { NextApiRequest, NextApiResponse } from 'next';
import { ContentClient, WorkflowClient, CANVAS_DRAFT_STATE } from '@uniformdev/canvas';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { projectId, entryId, workflowId } = req.query;

  if (!projectId || !workflowId) {
    return res.status(400).json({ message: 'Missing required parameters' });
  }

  const apiKey = process.env.UNIFORM_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ message: 'UNIFORM_API_KEY not configured' });
  }

  try {
    // Fetch workflow definition and entry stage in parallel
    const workflowClient = new WorkflowClient({
      apiKey,
      projectId: projectId as string,
    });

    const contentClient = new ContentClient({
      apiKey,
      projectId: projectId as string,
      bypassCache: true,
    });

    const [workflowResponse, entryResponse] = await Promise.all([
      workflowClient.get({ workflowIDs: [workflowId as string] }),
      entryId 
        ? contentClient.getEntries({
            entryIDs: [entryId as string],
            state: CANVAS_DRAFT_STATE,
            withWorkflowDefinition: true,
          })
        : Promise.resolve(null),
    ]);

    const workflow = workflowResponse.results?.[0];
    if (!workflow) {
      return res.status(404).json({ message: 'Workflow not found' });
    }

    // Convert stages object to sorted array with transitions
    const stagesArray = Object.entries(workflow.stages || {}).map(([id, stage]) => ({
      id,
      name: (stage as any).name,
      order: (stage as any).order,
      transitions: ((stage as any).transitions || []).map((t: any) => ({
        to: t.to,
        name: t.name,
        allowedRoles: Object.keys(t.permissions || {}),
      })),
      permissions: (stage as any).permissions || {},
      autoPublish: (stage as any).autoPublish,
    }));
    stagesArray.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

    // Get current stage from entry
    const entry = entryResponse?.entries?.[0];
    const currentStageId = entry 
      ? (entry as any)._workflowStageId || (entry as any).workflowStageId 
      : undefined;

    // Prevent caching to ensure fresh data
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    
    return res.status(200).json({
      workflowId: workflow.id,
      workflowName: workflow.name,
      initialStage: workflow.initialStage,
      stages: stagesArray,
      currentStageId,
    });
  } catch (error: any) {
    console.error('Error fetching workflow status:', error);
    return res.status(500).json({ 
      message: error.message || 'Failed to fetch workflow status' 
    });
  }
}
