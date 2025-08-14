import React, { useEffect, useMemo, useRef, useState } from 'react';

const DroppedObjectNoteEditor = ({ map, object, onSave, onCancel, objectUpdateTrigger }) => {
  const [text, setText] = useState(object?.properties?.note || '');
  const containerRef = useRef(null);

  useEffect(() => {
    setText(object?.properties?.note || '');
  }, [object?.id]);

  const style = useMemo(() => {
    if (!map || !object) return { display: 'none' };
    try {
      const p = map.project([object.position.lng, object.position.lat]);
      const x = p.x;
      const y = p.y;
      return {
        position: 'absolute',
        left: x + 10,
        top: y - 10,
        transform: 'translate(-50%, -100%)',
        zIndex: 2000,
        pointerEvents: 'auto'
      };
    } catch (_) {
      return { display: 'none' };
    }
  }, [map, object, objectUpdateTrigger]);

  return (
    <div ref={containerRef} style={style} className="max-w-sm w-64">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-200">Add Note</div>
        <div className="p-2">
          <textarea
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
            placeholder="Add a note for this item"
          />
        </div>
        <div className="px-2 pb-2 flex justify-end gap-2">
          <button onClick={onCancel} className="px-2 py-1 text-xs rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600">Cancel</button>
          <button onClick={() => onSave && onSave(text)} className="px-2 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700">Save</button>
        </div>
      </div>
    </div>
  );
};

export default DroppedObjectNoteEditor;


