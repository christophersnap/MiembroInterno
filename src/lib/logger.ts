import { supabase } from './supabase';

export const logActivity = async (
  action: string,
  entityType: string,
  entityId?: string | number | null,
  details?: any
) => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Resolver nombre real del usuario desde user_roles, metadatos o socorristas
    let userNombre: string | null =
      user.user_metadata?.nombre_usuario ||
      user.user_metadata?.nombre_completo ||
      user.user_metadata?.full_name ||
      user.user_metadata?.nombre ||
      null;

    try {
      const { data: ur } = await supabase
        .from('user_roles')
        .select('nombre_usuario, nombre_completo, socorristas (primer_nombre, primer_apellido)')
        .eq('id', user.id)
        .maybeSingle();

      if (ur) {
        const explicit = String(ur.nombre_usuario || ur.nombre_completo || '').trim();
        const soc: any = Array.isArray(ur.socorristas) ? ur.socorristas[0] : ur.socorristas;
        if (explicit) {
          userNombre = explicit;
        } else if (soc?.primer_nombre) {
          userNombre = `${soc.primer_nombre} ${soc.primer_apellido || ''}`.trim();
        }
      }
    } catch {}

    if (!userNombre && user.email) {
      try {
        const { data: soc } = await supabase
          .from('socorristas')
          .select('primer_nombre, primer_apellido')
          .eq('email', user.email)
          .maybeSingle();
        if (soc) {
          userNombre = `${soc.primer_nombre} ${soc.primer_apellido || ''}`.trim();
        }
      } catch {}
    }

    const enrichedDetails = {
      ...(details && typeof details === 'object' ? details : details ? { descripcion: String(details) } : {}),
      user_nombre: userNombre || user.email?.split('@')[0] || 'Usuario',
    };

    const basePayload = {
      user_id: user.id,
      user_email: user.email || null,
      action,
      entity_type: entityType,
      entity_id: entityId !== undefined && entityId !== null ? String(entityId) : null,
      details: enrichedDetails,
    };

    // Intento 1: inserción directa permitiendo que la secuencia / UUID asigne ID
    let { error } = await supabase.from('activity_logs').insert([basePayload]);

    // Intento 2: si falló por secuencia desfasada o ID entero requerido, calcular nextId
    if (error) {
      const errMsg = String(error.message || '').toLowerCase();
      if (errMsg.includes('duplicate') || errMsg.includes('null value in column "id"') || errMsg.includes('pkey')) {
        const { data: maxIdData } = await supabase
          .from('activity_logs')
          .select('id')
          .order('id', { ascending: false })
          .limit(1);

        const nextId =
          maxIdData && maxIdData.length > 0 && typeof maxIdData[0].id === 'number'
            ? maxIdData[0].id + 1
            : undefined;

        const retry = await supabase.from('activity_logs').insert([
          {
            ...(nextId ? { id: nextId } : {}),
            ...basePayload,
          },
        ]);
        error = retry.error;
      }
    }

    // Intento 3: fallback si la columna user_email no existiera aún
    if (error && String(error.message || '').toLowerCase().includes('user_email')) {
      const { user_email: _omit, ...withoutEmail } = basePayload;
      const fallback = await supabase.from('activity_logs').insert([withoutEmail]);
      if (fallback.error) {
        console.error('Fallback activity log failed:', fallback.error);
      }
    } else if (error) {
      console.warn('Activity log warning:', error.message);
    }
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
};
