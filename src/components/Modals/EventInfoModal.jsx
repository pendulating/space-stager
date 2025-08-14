import React, { useState, useEffect } from 'react';

const EventInfoModal = ({ isOpen, onClose, value, onChange }) => {
  const [form, setForm] = useState(value || {});

  useEffect(() => { setForm(value || {}); }, [value, isOpen]);

  if (!isOpen) return null;

  const update = (k, v) => {
    const next = { ...form, [k]: v };
    setForm(next);
  };

  const handleSave = () => {
    if (onChange) onChange(form);
    if (onClose) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg bg-white dark:bg-gray-800 rounded shadow-lg border border-gray-200 dark:border-gray-700">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Event Information</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">Optional details often requested by Parks or SAPO</p>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Event Name</label>
            <input className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" value={form.name || ''} onChange={e => update('name', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Organizer</label>
              <input className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" value={form.organizer || ''} onChange={e => update('organizer', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Contact</label>
              <input className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" value={form.contact || ''} onChange={e => update('contact', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Date</label>
              <input type="date" className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" value={form.date || ''} onChange={e => update('date', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Time</label>
              <input type="text" placeholder="e.g., 10:00 AM - 3:00 PM" className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" value={form.time || ''} onChange={e => update('time', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Expected Attendance</label>
              <input type="number" className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" value={form.attendance || ''} onChange={e => update('attendance', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Agency Permit # (optional)</label>
              <input className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" value={form.permit || ''} onChange={e => update('permit', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Notes</label>
            <textarea rows={3} className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" value={form.notes || ''} onChange={e => update('notes', e.target.value)} />
          </div>
        </div>
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 text-sm rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600">Cancel</button>
          <button onClick={handleSave} className="px-3 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700">Save</button>
        </div>
      </div>
    </div>
  );
};

export default EventInfoModal;


