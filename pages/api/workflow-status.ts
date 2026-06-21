import type { NextApiRequest, NextApiResponse } from 'next';
import { ContentClient, CanvasClient, WorkflowClient, CANVAS_DRAFT_STATE } from '@uniformdev/canvas';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { projectId, entityId, entityType, workflowId } = req.query;

  if (!projectId || !workflowId) {
    return res.status(400).json({ message: 'Missing required parameters' });
  }

  const apiKey = process.env.UNIFORM_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ message: 'UNIFORM_API_KEY not configured' });
  }

  try {
    const workflowClient = new WorkflowClient({
      apiKey,
      projectId: projectId as string,
    });

    // Fetch workflow definition
    const workflowResponse = await workflowClient.get({ workflowIDs: [workflowId as string] });

    const workflow = workflowResponse.results?.[0];
    if (!workflow) {
      return res.status(404).json({ message: 'Workflow not found' });
    }

    // Fetch current stage based on entity type
    let currentStageId: string | undefined;

    if (entityId && entityType === 'entry') {
      const contentClient = new ContentClient({
        apiKey,
        projectId: projectId as string,
        bypassCache: true,
      });

      const entryResponse = await contentClient.getEntries({
        entryIDs: [entityId as string],
        state: CANVAS_DRAFT_STATE,
        withWorkflowDefinition: true,
      });

      const entry = entryResponse?.entries?.[0];
      currentStageId = entry 
        ? (entry as any).workflowStageId || (entry as any)._workflowStageId
        : undefined;
    } else if (entityId && entityType === 'composition') {
      const canvasClient = new CanvasClient({
        apiKey,
        projectId: projectId as string,
        bypassCache: true,
      });

      const compositionResponse = await canvasClient.getCompositionById({
        compositionId: entityId as string,
        state: CANVAS_DRAFT_STATE,
      });

      // workflowStageId is at the response level, not inside composition
      currentStageId = (compositionResponse as any).workflowStageId 
        || (compositionResponse as any)._workflowStageId
        || (compositionResponse?.composition as any)?.workflowStageId
        || (compositionResponse?.composition as any)?._workflowStageId;
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
