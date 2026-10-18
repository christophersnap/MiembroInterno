import { supabase } from './supabase';

export const logActivity = async (
  action: string,
  entityType: string,
  entityId?: string | number | null,
  details?: any
) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch max ID to avoid sequence out of sync errors if id is integer
    const { data: maxIdData } = await supabase
      .from('activity_logs')
      .select('id')
      .order('id', { ascending: false })
      .limit(1);
      
    let nextId = undefined;
    if (maxIdData && maxIdData.length > 0 && typeof maxIdData[0].id === 'number') {
      nextId = maxIdData[0].id + 1;
    }

    const { error } = await supabase.from('activity_logs').insert([{
      ...(nextId ? { id: nextId } : {}),
      user_id: user.id,
      user_email: user.email,
      action,
      entity_type: entityType,
      entity_id: entityId ? String(entityId) : null,
      details
    }]);

    // If it fails, try without user_email
    if (error) {
      console.warn('Failed to log activity with user_email, trying fallback:', error);
      const { error: fallbackError } = await supabase.from('activity_logs').insert([{
        ...(nextId ? { id: nextId } : {}),
        user_id: user.id,
        action,
        entity_type: entityType,
        entity_id: entityId ? String(entityId) : null,
        details
      }]);
      if (fallbackError) {
        console.error('Fallback activity log failed:', fallbackError);
      }
    }
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
};
