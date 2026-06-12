import React, { useState } from 'react';
import {
  ClipboardList, Check, DollarSign, Package, AlertTriangle, TrendingDown,
  Camera, Tag, Hash, ChevronRight, Loader, RefreshCw
} from 'lucide-react';
import { useFetch, useApiRequest } from '../hooks/useApi';

const TYPE_META = {
  resolve_conflict:  { icon: AlertTriangle, color: 'var(--danger)',  label: 'Conflict' },
  add_price:         { icon: DollarSign,    color: 'var(--success)', label: 'Add Price' },
  verify_quantity:   { icon: Hash,          color: 'var(--warning)', label: 'Verify Qty' },
  add_category:      { icon: Tag,           color: 'var(--info)',    label: 'Category' },
  add_photo:         { icon: Camera,        color: 'var(--info)',    label: 'Add Photo' },
  add_name:          { icon: Package,       color: 'var(--text-secondary)', label: 'Add Name' },
  add_quantity:      { icon: Hash,          color: 'var(--warning)', label: 'Add Qty' },
  review_dead_stock: { icon: TrendingDown,  color: 'var(--warning)', label: 'Dead Stock' },
};

const PRIORITY_LABEL = { 1: 'Critical', 2: 'High', 3: 'Medium', 4: 'Low', 5: 'Lowest' };
const PRIORITY_COLOR = {
  1: 'var(--danger)', 2: 'var(--warning)', 3: 'var(--info)',
  4: 'var(--text-muted)', 5: 'var(--text-muted)',
};

export default function ActionCenter({ onNavigate, onSelectProduct }) {
  const { data, loading, error, refetch } = useFetch('/action-queue');
  const { post, patch } = useApiRequest();
  const [dismissed, setDismissed] = useState([]);
  const [expanded, setExpanded]   = useState(null);
  const [snoozing, setSnoozing]   = useState(null);
  const [resolving, setResolving] = useState(null);

  const allTasks = (data?.tasks || []).filter(t => !dismissed.includes(t.id));
  const p1 = allTasks.filter(t => t.priority === 1);
  const p2 = allTasks.filter(t => t.priority === 2);
  const other = allTasks.filter(t => t.priority > 2);

  const handleSnooze = async (taskId) => {
    setSnoozing(taskId);
    try {
      await post(`/action-queue/${taskId}/snooze`);
      setDismissed(d => [...d, taskId]);
      if (expanded === taskId) setExpanded(null);
    } finally {
      setSnoozing(null);
    }
  };

  const handleResolveConflict = async (task) => {
    setResolving(task.id);
    try {
      await patch(`/stock-lots/${task.stockLotId}`, { trigger: 'conflict_resolved' });
      setDismissed(d => [...d, task.id]);
      if (expanded === task.id) setExpanded(null);
      window.dispatchEvent(new CustomEvent('inv:mutation'));
      refetch();
    } finally {
      setResolving(null);
    }
  };

  const TaskCard = ({ task, i }) => {
    const meta = TYPE_META[task.type] || { icon: ClipboardList, color: 'var(--text-secondary)', label: task.type };
    const Icon = meta.icon;
    const isOpen = expanded === task.id;

    const navigateToProduct = () => {
      if (onSelectProduct && task.productId) onSelectProduct(task.productId);
      else onNavigate('inventory');
    };

    return (
      <div
        style={{
          background: 'var(--surface)', border: `1px solid ${isOpen ? meta.color + '28' : 'var(--border)'}`,
          borderRadius: 'var(--radius-lg)', overflow: 'hidden', transition: 'border-color 0.15s ease',
          animation: `fadeIn 0.2s ease ${Math.min(i, 6) * 0.04}s both`,
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer' }}
          onClick={() => setExpanded(isOpen ? null : task.id)}
        >
          <div style={{
            width: 34, height: 34, borderRadius: 8, flexShrink: 0,
            background: `${meta.color}12`, border: `1px solid ${meta.color}28`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={15} color={meta.color} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{task.label}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'flex', gap: 8 }}>
              <span style={{ color: task.type === 'resolve_conflict' ? 'var(--danger)' : 'var(--text-muted)' }}>{meta.label}</span>
              {task.confidenceDelta && task.confidenceDelta !== '0%' && (
                <span style={{ color: 'var(--success)' }}>↑ {task.confidenceDelta} confidence</span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 100,
              color: PRIORITY_COLOR[task.priority],
              background: `${PRIORITY_COLOR[task.priority]}12`,
              border: `1px solid ${PRIORITY_COLOR[task.priority]}28`,
            }}>
              {PRIORITY_LABEL[task.priority]}
            </span>
            <ChevronRight
              size={14} color="var(--text-muted)"
              style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s ease' }}
            />
          </div>
        </div>

        {isOpen && (
          <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px', background: 'var(--surface2)', animation: 'fadeIn 0.15s ease' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
              <strong style={{ color: 'var(--text-primary)' }}>Product:</strong> {task.productName}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {task.action === 'resolve_conflict' && (
                <>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleResolveConflict(task)}
                    disabled={resolving === task.id}
                  >
                    {resolving === task.id
                      ? <Loader size={12} style={{ animation: 'spin 0.8s linear infinite' }} />
                      : <><AlertTriangle size={12} /> Resolve conflict</>}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={navigateToProduct}>
                    <Package size={12} /> View product
                  </button>
                </>
              )}
              {(task.action === 'edit_product' || task.action === 'view_product' ||
                task.action === 'count_entry' || task.action === 'edit_draft') && (
                <button className="btn btn-primary btn-sm" onClick={navigateToProduct}>
                  <Package size={12} /> Go to product
                </button>
              )}
              {task.action === 'photo_capture' && (
                <button className="btn btn-primary btn-sm" onClick={() => onNavigate('photo')}>
                  <Camera size={12} /> Add photo
                </button>
              )}
              {task.action !== 'resolve_conflict' && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleSnooze(task.id)}
                  disabled={snoozing === task.id}
                >
                  {snoozing === task.id
                    ? <Loader size={12} style={{ animation: 'spin 0.8s linear infinite' }} />
                    : 'Snooze 7 days'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="page" style={{ maxWidth: 800 }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>
            Action Center
          </div>
          <h1 className="page-title" style={{ fontSize: 28 }}>Your next steps</h1>
          <p className="page-subtitle">
            {loading ? 'Loading…' : `${allTasks.length} action${allTasks.length !== 1 ? 's' : ''} pending`}
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={refetch} disabled={loading}>
          <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {error && (
        <div style={{ marginBottom: 20, padding: '12px 16px', background: 'var(--danger-dim)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--danger)' }}>
          Failed to load actions. <button onClick={refetch} style={{ textDecoration: 'underline', cursor: 'pointer', background: 'none', border: 'none', color: 'var(--danger)', fontSize: 13, fontFamily: 'var(--font-body)' }}>Retry</button>
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1,2,3].map(i => (
            <div key={i} className="skeleton" style={{ height: 64, borderRadius: 'var(--radius-lg)' }} />
          ))}
        </div>
      )}

      {!loading && !error && allTasks.length === 0 && (
        <div className="empty-state" style={{ padding: '64px 24px' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%', background: 'var(--success-dim)',
            border: '1px solid rgba(22,163,74,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Check size={24} color="var(--success)" />
          </div>
          <h3>All caught up!</h3>
          <p>No actions needed right now. Check back after adding inventory.</p>
        </div>
      )}

      {!loading && p1.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <AlertTriangle size={13} color="var(--danger)" />
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Critical — Resolve First
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {p1.map((t, i) => <TaskCard key={t.id} task={t} i={i} />)}
          </div>
        </div>
      )}

      {!loading && p2.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <DollarSign size={13} color="var(--success)" />
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Revenue Impact
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {p2.map((t, i) => <TaskCard key={t.id} task={t} i={i} />)}
          </div>
        </div>
      )}

      {!loading && other.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <ClipboardList size={13} color="var(--text-muted)" />
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Data Quality
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {other.map((t, i) => <TaskCard key={t.id} task={t} i={p2.length + i} />)}
          </div>
        </div>
      )}
    </div>
  );
}
