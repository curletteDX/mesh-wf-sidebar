import type { NextApiRequest, NextApiResponse } from 'next';
import { ContentClient, CANVAS_DRAFT_STATE } from '@uniformdev/canvas';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { projectId, entryId } = req.query;

  if (!projectId || !entryId) {
    return res.status(400).json({ message: 'Missing required parameters' });
  }

  const apiKey = process.env.UNIFORM_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ message: 'UNIFORM_API_KEY not configured' });
  }

  try {
    const contentClient = new ContentClient({
      apiKey,
      projectId: projectId as string,
    });

    const response = await contentClient.getEntries({
      entryIDs: [entryId as string],
      state: CANVAS_DRAFT_STATE,
      withWorkflowDefinition: true,
    });

    const entry = response.entries?.[0];
    if (!entry) {
      return res.status(404).json({ message: 'Entry not found' });
    }

    // The entry should now include workflow stage info
    return res.status(200).json({
      stageId: (entry as any)._workflowStageId || (entry as any).workflowStageId,
      stageName: (entry as any)._workflowStageName || (entry as any).workflowStageName,
      workflowDefinition: (entry as any).workflowDefinition,
      // Include all workflow-related fields for debugging
      _debug: Object.fromEntries(
        Object.entries(entry as any).filter(([key]) => 
          key.toLowerCase().includes('workflow') || key.toLowerCase().includes('stage')
        )
      ),
    });
  } catch (error: any) {
    console.error('Error fetching entry stage:', error);
    return res.status(500).json({ 
      message: error.message || 'Failed to fetch entry stage' 
    });
  }
}
