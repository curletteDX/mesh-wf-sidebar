import type { NextApiRequest, NextApiResponse } from 'next';
import { WorkflowClient } from '@uniformdev/canvas';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { projectId, workflowId } = req.query;

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

    const response = await workflowClient.get({
      workflowIDs: [workflowId as string],
    });

    const workflow = response.results?.[0];
    if (!workflow) {
      return res.status(404).json({ message: 'Workflow not found' });
    }

    // Convert stages object to array with id included
    const stagesArray = Object.entries(workflow.stages || {}).map(([id, stage]) => ({
      id,
      name: (stage as any).name,
      order: (stage as any).order,
    }));

    // Sort by order if available
    stagesArray.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

    return res.status(200).json({
      workflowId: workflow.id,
      workflowName: workflow.name,
      initialStage: workflow.initialStage,
      stages: stagesArray,
    });
  } catch (error: any) {
    console.error('Error fetching workflow:', error);
    return res.status(500).json({ 
      message: error.message || 'Failed to fetch workflow information' 
    });
  }
}
