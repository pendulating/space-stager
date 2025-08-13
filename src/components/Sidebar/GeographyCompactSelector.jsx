import React, { useMemo, useState } from 'react';
import { useGeography } from '../../contexts/GeographyContext';
import { GEOGRAPHIES } from '../../constants/geographies';
import ConfirmModal from '../Modals/ConfirmModal';

const GeographyCompactSelector = ({ onConfirmChange }) => {
  const { geographyType, selectGeography } = useGeography();
  const [pending, setPending] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const options = useMemo(() => ([
    { id: 'parks', label: 'Parks' },
    { id: 'plazas', label: 'Plazas' },
    { id: 'intersections', label: 'Intersections' }
  ]), []);

  const handleChange = (newType) => {
    if (newType === geographyType) return;
    setPending(newType);
    setShowConfirm(true);
  };

  const confirm = () => {
    const next = pending;
    setShowConfirm(false);
    setPending(null);
    if (next) {
      selectGeography(next);
      onConfirmChange && onConfirmChange(next);
    }
  };

  const cancel = () => {
    setShowConfirm(false);
    setPending(null);
  };

  return (
    <div className="bg-white border-b border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">Geography</h3>
        <div className="flex items-center space-x-2">
          {options.map(opt => (
            <button
              key={opt.id}
              onClick={() => handleChange(opt.id)}
              className={`px-2.5 py-1.5 rounded text-xs border ${
                geographyType === opt.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div className="text-xs text-gray-600">
        {GEOGRAPHIES[geographyType]?.info || ''}
      </div>

      <ConfirmModal
        isOpen={showConfirm}
        title="Change geography?"
        message="Changing geography will clear your focused area, shapes, and placed objects. Are you sure you want to abandon your work?"
        confirmText="Yes, change"
        cancelText="Cancel"
        onConfirm={confirm}
        onCancel={cancel}
      />
    </div>
  );
};

export default GeographyCompactSelector;


