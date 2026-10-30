import { createClient } from '@supabase/supabase-js';

const required = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'DEMO_PASSWORD'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing ${key} in .env.local`);
    process.exit(1);
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

function check(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

const daysFromNow = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};
const dateTimeDaysAgo = (days, hour = 10) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

const people = [
  { email: 'riya@contextflow.demo', full_name: 'Riya', role_title: 'Project Manager' },
  { email: 'harsh@contextflow.demo', full_name: 'Harsh', role_title: 'Backend Developer' },
  { email: 'vedant@contextflow.demo', full_name: 'Vedant', role_title: 'Frontend Developer' },
  { email: 'aryan@contextflow.demo', full_name: 'Aryan', role_title: 'QA Engineer' },
];

async function getOrCreateDemoUser(person) {
  const { data: listed, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) throw listError;
  let user = listed.users.find((u) => u.email?.toLowerCase() === person.email);
  if (!user) {
    const created = check(await supabase.auth.admin.createUser({
      email: person.email,
      password: process.env.DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: person.full_name, role_title: person.role_title, is_seed: true },
    }), `Create demo user ${person.email}`);
    user = created.user;
  }
  check(await supabase.from('profiles').upsert({
    id: user.id,
    email: person.email,
    full_name: person.full_name,
    role_title: person.role_title,
    is_seed: true,
  }), `Upsert profile ${person.email}`);
  return { ...person, id: user.id };
}

async function main() {
  console.log('Preparing fictional SYNAPSE team accounts...');
  const members = [];
  for (const person of people) members.push(await getOrCreateDemoUser(person));
  const [riya, harsh, vedant, aryan] = members;

  console.log('Removing the previous seeded workspace, if one exists...');
  const oldTeams = check(await supabase.from('teams').select('id').eq('is_seed', true), 'Find previous demo workspace');
  for (const old of oldTeams ?? []) {
    check(await supabase.from('teams').delete().eq('id', old.id), 'Remove previous demo workspace');
  }

  console.log('Creating SYNAPSE Product Launch workspace...');
  const team = check(await supabase.from('teams').insert({
    name: 'SYNAPSE Product Launch',
    slug: 'synapse-product-launch-demo',
    created_by: riya.id,
    is_seed: true,
  }).select('id').single(), 'Create demo workspace');

  check(await supabase.from('team_members').insert([
    { team_id: team.id, user_id: riya.id, role: 'admin' },
    { team_id: team.id, user_id: harsh.id, role: 'member' },
    { team_id: team.id, user_id: vedant.id, role: 'member' },
    { team_id: team.id, user_id: aryan.id, role: 'member' },
  ]), 'Add demo team members');

  console.log('Creating six connected meetings...');
  const meetingSpecs = [
    { title: 'Product kickoff and scope alignment', days: 12, owner: riya, agenda: 'Agree on launch scope, success metrics and ownership.', notes: 'The team agreed to launch the SYNAPSE workspace experience in phases. Riya owns the launch plan. Harsh will define the API contract. Vedant will deliver the dashboard shell. Aryan will prepare the first regression checklist. The initial target is a stable internal demo before the wider pilot.', summary: 'The team aligned on a phased internal launch, ownership and a stable demo milestone.', points: ['Use a phased launch with an internal demo first.', 'Keep the first release focused on meetings, tasks and knowledge retrieval.'], questions: ['Who will approve the pilot feedback checklist?'] },
    { title: 'Backend API and authentication review', days: 9, owner: harsh, agenda: 'Review authentication, workspace membership and API contracts.', notes: 'Harsh confirmed the workspace membership flow and server-side authorization approach. Riya asked for an audit trail on task ownership changes. Harsh will finish API validation and add integration tests. The team agreed that service-role credentials must never reach the browser.', summary: 'Authentication and workspace access design were reviewed; API validation and audit coverage remain in progress.', points: ['Keep privileged Supabase operations server-side.', 'Record ownership changes in task history.'], questions: ['Can the invite flow support expired invitations?'] },
    { title: 'Dashboard experience review', days: 7, owner: vedant, agenda: 'Review dashboard hierarchy, task views and responsive layout.', notes: 'Vedant presented the dashboard and task board. Riya requested clearer overdue indicators and a compact activity timeline. Harsh will expose the task history fields required by the UI. Vedant will refine empty states and mobile navigation.', summary: 'Dashboard structure was approved with follow-up polish for overdue indicators, activity and mobile navigation.', points: ['Keep overdue tasks visible without overwhelming the dashboard.', 'Use a consistent empty state across modules.'], questions: ['Should the mobile task board default to list view?'] },
    { title: 'Knowledge base ingestion checkpoint', days: 5, owner: harsh, agenda: 'Validate document upload, text extraction and retrieval.', notes: 'The team tested text and PDF ingestion. Harsh will improve extraction error handling and ensure document chunks remain scoped to the active workspace. Aryan will prepare files with tables and scanned pages for QA. Riya wants every AI answer to show its source document.', summary: 'Document ingestion is progressing; workspace-scoped chunks and visible source citations are required before pilot.', points: ['Test PDFs with tables and scanned pages.', 'Show source citations alongside answers.'], questions: ['What file size limit should the pilot enforce?'] },
    { title: 'QA readiness and bug triage', days: 3, owner: aryan, agenda: 'Review test coverage, defects and release blockers.', notes: 'Aryan reported three issues: task filters reset after navigation, an upload error message is unclear, and the handover acknowledgement needs a confirmation state. The team classified the filter issue as medium priority and the acknowledgement state as high priority. Aryan will rerun regression after fixes.', summary: 'QA identified three issues; handover acknowledgement feedback is the highest-priority fix.', points: ['Fix handover acknowledgement feedback before the pilot.', 'Rerun regression after the dashboard and upload fixes.'], questions: ['Who will sign off the final regression run?'] },
    { title: 'Pilot launch go/no-go', days: 1, owner: riya, agenda: 'Confirm launch readiness, open risks and next steps.', notes: 'The team reviewed the pilot checklist. The dashboard and task workflows are ready for internal use. Knowledge ingestion needs one more pass on large PDFs. Aryan will own the final regression run. Harsh will monitor ingestion errors. Vedant will publish the final responsive layout. Riya will coordinate pilot feedback.', summary: 'The internal pilot can proceed with monitoring on large PDF ingestion and a final regression pass.', points: ['Proceed with a limited internal pilot.', 'Monitor large PDF ingestion and collect structured feedback.'], questions: ['When should the team review pilot feedback?'] },
  ];

  const meetings = [];
  for (const spec of meetingSpecs) {
    const row = check(await supabase.from('meetings').insert({
      team_id: team.id,
      title: spec.title,
      scheduled_at: dateTimeDaysAgo(spec.days),
      agenda: spec.agenda,
      notes: spec.notes,
      summary: spec.summary,
      discussion_points: spec.points,
      unresolved_questions: spec.questions,
      created_by: spec.owner.id,
      is_seed: true,
    }).select('id,title,scheduled_at').single(), `Create meeting ${spec.title}`);
    meetings.push(row);
    check(await supabase.from('meeting_participants').insert(members.map((m) => ({ meeting_id: row.id, user_id: m.id, attended: true }))), `Add participants to ${spec.title}`);
  }

  const taskSpecs = [
    ['Finalize workspace membership API', 'Add validation for workspace membership and role checks.', harsh, 2, 'high', 'in_progress', 1],
    ['Add task history audit events', 'Record status, owner and due-date changes in the task timeline.', harsh, 1, 'high', 'todo', 1],
    ['Polish dashboard overdue indicators', 'Make overdue work easy to identify in list and board views.', vedant, 3, 'medium', 'in_progress', 3],
    ['Implement responsive mobile navigation', 'Verify sidebar and navigation behavior on narrow screens.', vedant, 4, 'medium', 'todo', 3],
    ['Prepare regression checklist', 'Cover authentication, tasks, meetings, uploads and handovers.', aryan, 1, 'high', 'in_progress', 1],
    ['Test PDF extraction with tables', 'Validate extraction behavior for multi-page PDFs containing tables.', aryan, 2, 'high', 'blocked', 4],
    ['Add source citations to AI answers', 'Show document and meeting references in Ask SYNAPSE.', harsh, 5, 'high', 'todo', 4],
    ['Finalize pilot feedback form', 'Collect usability feedback from internal pilot users.', riya, 6, 'low', 'todo', 6],
    ['Review onboarding copy', 'Simplify workspace setup instructions and first-run guidance.', riya, -1, 'low', 'completed', 1],
    ['Fix handover acknowledgement state', 'Show clear pending, accepted and declined states.', vedant, 1, 'high', 'in_progress', 5],
    ['Verify task carry-forward behavior', 'Ensure carried tasks retain their original identity and history.', aryan, 3, 'medium', 'todo', 2],
    ['Add document upload size validation', 'Return a clear error for files above the configured limit.', harsh, 2, 'medium', 'todo', 4],
    ['Publish final responsive dashboard', 'Complete visual QA for desktop and mobile dashboard layouts.', vedant, 0, 'high', 'completed', 6],
    ['Coordinate internal pilot', 'Invite pilot users and collect feedback during the first week.', riya, 7, 'medium', 'todo', 6],
    ['Monitor document ingestion errors', 'Review ingestion logs and triage extraction failures.', harsh, 4, 'medium', 'blocked', 6],
    ['Document release rollback steps', 'Write a short operational rollback and recovery checklist.', aryan, 8, 'low', 'todo', 5],
    ['Review API error handling', 'Ensure server actions return actionable user-facing errors.', harsh, -2, 'medium', 'completed', 2],
    ['Create pilot demo walkthrough', 'Prepare a five-minute walkthrough of the core SYNAPSE workflows.', riya, 2, 'medium', 'in_progress', 6],
    ['Validate task filters after navigation', 'Confirm owner and status filters remain consistent across routes.', aryan, 0, 'medium', 'blocked', 3],
    ['Approve launch scope', 'Confirm the first release scope and success criteria.', riya, -3, 'high', 'completed', 1],
  ];
  console.log('Creating 20 tasks and their meeting links...');
  const tasks = [];
  for (const [title, description, assignee, dueOffset, priority, status, meetingIndex] of taskSpecs) {
    const completed = status === 'completed';
    const task = check(await supabase.from('tasks').insert({
      team_id: team.id,
      title,
      description,
      assignee_id: assignee.id,
      due_date: daysFromNow(dueOffset),
      priority,
      status,
      origin_meeting_id: meetings[meetingIndex - 1].id,
      completion_outcome: completed ? 'Completed and reviewed by the team.' : null,
      completed_at: completed ? dateTimeDaysAgo(1) : null,
      source: 'ai_extracted',
      owner_uncertain: false,
      created_by: riya.id,
      is_seed: true,
    }).select('id,title').single(), `Create task ${title}`);
    tasks.push(task);
    check(await supabase.from('meeting_tasks').insert({ meeting_id: meetings[meetingIndex - 1].id, task_id: task.id, relation: 'originated', created_by: riya.id }), `Link task ${title} to meeting`);
    check(await supabase.from('task_history').insert({
      task_id: task.id,
      actor_id: assignee.id,
      action: 'created',
      meeting_id: meetings[meetingIndex - 1].id,
      note: 'Created from the SYNAPSE demo meeting.',
    }), `Add task history for ${title}`);
    if (status !== 'todo') {
      check(await supabase.from('task_history').insert({
        task_id: task.id,
        actor_id: assignee.id,
        action: status === 'completed' ? 'completed' : 'status_changed',
        field: 'status',
        old_value: 'todo',
        new_value: status,
        meeting_id: meetings[meetingIndex - 1].id,
        note: completed ? 'Demo task completed.' : 'Progress updated during a demo check-in.',
      }), `Add status history for ${title}`);
    }
  }

  console.log('Creating meeting decisions...');
  const decisions = [
    [meetings[0].id, 'Launch SYNAPSE in phases, beginning with an internal pilot.', 'A smaller pilot reduces risk and gives the team time to improve workflows.', riya],
    [meetings[0].id, 'Keep the first release focused on meetings, tasks and knowledge retrieval.', 'These workflows demonstrate the core continuity value.', riya],
    [meetings[1].id, 'All privileged Supabase operations must remain server-side.', 'Service-role credentials must never be exposed to the browser.', harsh],
    [meetings[2].id, 'Show overdue tasks with a clear but restrained visual indicator.', 'Users need to identify urgent work without adding dashboard clutter.', vedant],
    [meetings[3].id, 'Every AI-generated answer should include source references.', 'Users need to verify where an answer came from.', harsh],
    [meetings[4].id, 'Fix handover acknowledgement feedback before the pilot.', 'The receiving owner must understand whether a transfer was accepted.', aryan],
    [meetings[5].id, 'Proceed with a limited internal pilot while monitoring large PDF ingestion.', 'Core workflows are ready, with one known ingestion risk to monitor.', riya],
  ];
  for (const [meetingId, text, rationale, actor] of decisions) {
    check(await supabase.from('decisions').insert({ team_id: team.id, meeting_id: meetingId, text, rationale, source: 'manual', created_by: actor.id, is_seed: true }), 'Create decision');
  }

  console.log('Creating sample knowledge documents and searchable chunks...');
  const docs = [
    { title: 'SYNAPSE Product Requirements', filename: 'synapse-product-requirements.txt', content: 'SYNAPSE PRODUCT REQUIREMENTS\n\nPurpose: SYNAPSE is a team knowledge continuity workspace. It connects meetings, decisions, tasks, documents and handovers so work can continue without repeatedly reconstructing context.\n\nFirst release scope: workspace dashboard, meeting capture, AI-assisted extraction, task management, carry-forward, document upload and retrieval, Ask SYNAPSE, Catch Me Up, Smart Handovers and activity history.\n\nSuccess measures: users can identify current priorities quickly; action items have clear owners and deadlines; decisions retain meeting context; AI answers include source references; handovers require explicit recipient acknowledgement.' },
    { title: 'API and Authentication Notes', filename: 'api-authentication-notes.txt', content: 'API AND AUTHENTICATION NOTES\n\nAuthentication uses Supabase Auth. Server components and server actions obtain the current user from the server-side Supabase client. Row Level Security limits team data to workspace members.\n\nThe Supabase service-role key is server-only and must never use a NEXT_PUBLIC_ prefix. Privileged account administration and demo seeding must run in a trusted server-side or local script environment.\n\nWorkspace membership is represented by team_members. The active workspace is selected through the server-managed cf_team cookie. Task changes should create task_history entries.' },
    { title: 'Pilot QA Checklist', filename: 'pilot-qa-checklist.txt', content: 'PILOT QA CHECKLIST\n\nAuthentication: sign up, sign in, sign out and protected-route behavior.\nTasks: create, edit, reassign, change status, complete, delete and inspect history.\nMeetings: create meeting, save notes, generate extraction draft, review decisions and confirm action items.\nCarry-forward: select an open task from a prior meeting and verify the same task ID and history are retained.\nKnowledge: upload a text or PDF file, confirm extracted text and chunks, then search for a phrase.\nAsk SYNAPSE: ask a question that is answerable from a meeting or document and verify citations.\nHandovers: generate a brief, create a pending handover, then test recipient acknowledgement.\nSecurity: verify a member cannot access another workspace’s records.' },
    { title: 'Internal Pilot Launch Plan', filename: 'internal-pilot-launch-plan.txt', content: 'INTERNAL PILOT LAUNCH PLAN\n\nThe pilot begins with a small internal group. Riya coordinates onboarding and feedback. Harsh monitors API behavior and document ingestion. Vedant handles responsive UI polish. Aryan owns regression testing and defect triage.\n\nBefore pilot: complete regression, validate workspace isolation, verify task history, test document extraction and confirm handover acknowledgement.\n\nDuring pilot: collect feedback, review ingestion errors, track blocked tasks and record decisions in meeting notes.\n\nAfter pilot: prioritize usability issues, review adoption signals and agree the next release scope.' },
  ];
  const docRows = [];
  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    const row = check(await supabase.from('documents').insert({
      team_id: team.id,
      title: doc.title,
      filename: doc.filename,
      mime_type: 'text/plain',
      content: doc.content,
      uploaded_by: riya.id,
      meeting_id: meetings[Math.min(i, meetings.length - 1)].id,
      is_seed: true,
    }).select('id,title').single(), `Create document ${doc.title}`);
    docRows.push(row);
    check(await supabase.from('document_chunks').insert({ document_id: row.id, team_id: team.id, chunk_index: 0, content: doc.content }), `Create chunk for ${doc.title}`);
  }
  for (const task of tasks.slice(0, 8)) {
    const docIndex = task.title.toLowerCase().includes('pdf') || task.title.toLowerCase().includes('document') ? 2 : task.title.toLowerCase().includes('api') || task.title.toLowerCase().includes('workspace') ? 1 : 0;
    check(await supabase.from('task_documents').insert({ task_id: task.id, document_id: docRows[docIndex].id }), `Link document to ${task.title}`);
  }

  console.log('Creating two handover examples...');
  const handoverOne = check(await supabase.from('handovers').insert({
    team_id: team.id,
    from_user: harsh.id,
    to_user: vedant.id,
    project: 'Workspace integration handover',
    reason: 'Backend integration work is moving into UI verification.',
    notes: 'Review the membership API contract and confirm the dashboard integration behavior.',
    brief: { generatedBy: 'records', sections: [{ key: 'overview', title: 'Project overview', items: [{ text: 'Harsh is handing workspace integration context to Vedant for UI verification.', sources: [] }] }, { key: 'nextSteps', title: 'Recommended next steps', items: [{ text: 'Review the API contract and validate the dashboard integration.', sources: [] }] }] },
    status: 'pending',
    created_by: harsh.id,
    is_seed: true,
  }).select('id').single(), 'Create pending handover');
  check(await supabase.from('handover_tasks').insert([{ handover_id: handoverOne.id, task_id: tasks[0].id, previous_owner_id: harsh.id, new_owner_id: vedant.id }, { handover_id: handoverOne.id, task_id: tasks[6].id, previous_owner_id: harsh.id, new_owner_id: vedant.id }]), 'Link pending handover tasks');

  const handoverTwo = check(await supabase.from('handovers').insert({
    team_id: team.id,
    from_user: vedant.id,
    to_user: aryan.id,
    project: 'Dashboard regression handover',
    reason: 'UI implementation is ready for final regression.',
    notes: 'Responsive dashboard work is complete. Please validate filters and navigation.',
    brief: { generatedBy: 'records', sections: [{ key: 'overview', title: 'Project overview', items: [{ text: 'Vedant has handed the dashboard regression context to Aryan.', sources: [] }] }] },
    status: 'acknowledged',
    acknowledged_at: dateTimeDaysAgo(1),
    created_by: vedant.id,
    is_seed: true,
  }).select('id').single(), 'Create acknowledged handover');
  check(await supabase.from('handover_tasks').insert({ handover_id: handoverTwo.id, task_id: tasks[12].id, previous_owner_id: vedant.id, new_owner_id: aryan.id, transferred: true, transferred_at: dateTimeDaysAgo(1) }), 'Link acknowledged handover task');

  console.log('Creating activity feed entries...');
  const activity = [
    { actor_id: riya.id, action: 'meeting.created', entity_type: 'meeting', entity_id: meetings[0].id, summary: 'created the product kickoff and scope alignment meeting' },
    { actor_id: harsh.id, action: 'task.created', entity_type: 'task', entity_id: tasks[0].id, summary: 'created “Finalize workspace membership API”' },
    { actor_id: vedant.id, action: 'task.completed', entity_type: 'task', entity_id: tasks[12].id, summary: 'completed “Publish final responsive dashboard”' },
    { actor_id: aryan.id, action: 'handover.acknowledged', entity_type: 'handover', entity_id: handoverTwo.id, summary: 'acknowledged the dashboard regression handover' },
    { actor_id: riya.id, action: 'document.uploaded', entity_type: 'document', entity_id: docRows[0].id, summary: 'added the SYNAPSE Product Requirements document' },
    { actor_id: harsh.id, action: 'handover.created', entity_type: 'handover', entity_id: handoverOne.id, summary: 'created a workspace integration handover for Vedant' },
  ];
  check(await supabase.from('activity_logs').insert(activity.map((a) => ({ ...a, team_id: team.id, metadata: { isDemoSeed: true } }))), 'Create activity feed');

  console.log('\nDemo workspace seeded successfully.');
  console.log(`Workspace: SYNAPSE Product Launch (${team.id})`);
  console.log('Demo accounts:');
  for (const member of members) console.log(` - ${member.full_name}: ${member.email}`);
  console.log('Use your own existing account and the Join Demo Workspace action to enter the workspace.');
  console.log('The fictional account password is the DEMO_PASSWORD value in .env.local.');
}

main().catch((error) => {
  console.error('\nDemo seeding failed:', error.message ?? error);
  process.exit(1);
});
