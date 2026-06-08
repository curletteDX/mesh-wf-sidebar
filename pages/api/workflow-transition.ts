import type { NextApiRequest, NextApiResponse } from 'next';
import { ContentClient, CanvasClient, CANVAS_DRAFT_STATE } from '@uniformdev/canvas';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { projectId, entityId, entityType, targetStageId } = req.body;

  if (!projectId || !entityId || !entityType || !targetStageId) {
    return res.status(400).json({ message: 'Missing required parameters' });
  }

  const apiKey = process.env.UNIFORM_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ message: 'UNIFORM_API_KEY not configured' });
  }

  try {
    if (entityType === 'entry') {
      const contentClient = new ContentClient({
        apiKey,
        projectId: projectId as string,
      });

      // Fetch the current entry
      const response = await contentClient.getEntries({
        entryIDs: [entityId],
        state: CANVAS_DRAFT_STATE,
      });

      const entryResponse = response.entries?.[0];
      if (!entryResponse) {
        return res.status(404).json({ message: 'Entry not found' });
      }

      // The entry data is nested inside the response
      const entryData = entryResponse.entry;

      // Update the entry with the new workflow stage
      // workflowStageId is at the body level, not inside entry
      await contentClient.upsertEntry({
        state: CANVAS_DRAFT_STATE,
        entry: {
          _id: entryData._id,
          _name: entryData._name,
          type: entryData.type,
          fields: entryData.fields || {},
          _locales: entryData._locales,
        },
        workflowId: entryResponse.workflowId,
        workflowStageId: targetStageId,
      });

      return res.status(200).json({ 
        success: true, 
        message: 'Workflow stage updated successfully',
        newStageId: targetStageId,
      });
    }

    if (entityType === 'composition') {
      const canvasClient = new CanvasClient({
        apiKey,
        projectId: projectId as string,
      });

      // Fetch the current composition
      const response = await canvasClient.getCompositionById({
        compositionId: entityId,
        state: CANVAS_DRAFT_STATE,
      });

      const composition = response.composition;
      if (!composition) {
        return res.status(404).json({ message: 'Composition not found' });
      }

      // Update the composition with the new workflow stage
      await canvasClient.updateComposition({
        state: CANVAS_DRAFT_STATE,
        composition,
        workflowStageId: targetStageId,
      } as any);

      return res.status(200).json({ 
        success: true, 
        message: 'Workflow stage updated successfully',
        newStageId: targetStageId,
      });
    }

    return res.status(400).json({ message: 'Invalid entity type' });
  } catch (error: any) {
    console.error('Error transitioning workflow:', error);
    return res.status(500).json({ 
      message: error.message || 'Failed to transition workflow stage',
      details: error.response?.data || error.toString(),
    });
  }
}
