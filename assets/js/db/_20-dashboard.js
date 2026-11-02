// assets/js/db/_20-dashboard.js
// Dashboard guru stats

async function getTeacherDashboardStats(teacherId, forceRefresh = false) {
  return cache.fetch(`guru_stats_${teacherId}`, async () => {
    const client = initSupabase();

    const plans = await getMyAnnualPlans(teacherId);
    const planIds = plans.map(p => p.id);

    let units = [];
    if (planIds.length > 0) {
      const { data } = await client.from('units')
        .select('id, title, status, annual_plan_id')
        .in('annual_plan_id', planIds);
      units = data || [];
    }
    const unitIds = units.map(u => u.id);

    let activities = [];
    if (unitIds.length > 0) {
      const { data } = await client.from('unit_activities')
        .select('id, title, type, unit_id').in('unit_id', unitIds);
      activities = data || [];
    }
    const activityIds = activities.map(a => a.id);

    let pendingSubs = [];
    if (activityIds.length > 0) {
      const { data } = await client.from('submissions')
        .select('id, activity_id, assessment_id, status, submitted_at, student_id, profiles!submissions_student_profile_fkey (name)')
        .in('activity_id', activityIds)
        .eq('status', 'submitted')
        .order('submitted_at', { ascending: false })
        .limit(20);
      pendingSubs = data || [];
    }

    return {
      totalAnnualPlans: plans.length,
      totalUnits: units.length,
      publishedUnits: units.filter(u => u.status === 'published').length,
      draftUnits: units.filter(u => u.status === 'draft').length,
      archivedUnits: units.filter(u => u.status === 'archived').length,
      totalActivities: activities.length,
      pendingSubmissions: pendingSubs.length,
      pendingSubmissionsList: pendingSubs,
      plans
    };
  }, { ttl: 5 * 60 * 1000, forceRefresh });
}