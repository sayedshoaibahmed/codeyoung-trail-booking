import { useState } from 'react';
import { cancelBookingApi } from '../api';
import { ApiError } from '../../../shared/api/base';
import { Button } from '../../../shared/ui/button';
import { Input } from '../../../shared/ui/input';

interface CancelBookingDialogProps {
  bookingId: string;
  onSuccess: () => void;
  onClose: () => void;
}

export function CancelBookingDialog({ bookingId, onSuccess, onClose }: CancelBookingDialogProps) {
  const [token, setToken] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCancel = async () => {
    if (!token) {
      setError('Cancellation token is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await cancelBookingApi.cancel(bookingId, { cancellationToken: token });
      onSuccess();
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err.message || 'Cancellation failed.');
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 sm:p-8 border border-slate-100 my-auto max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <h3 className="text-xl font-extrabold text-teal-950 mb-2">Cancel Class</h3>
        <p className="text-sm text-slate-500 mb-6 font-medium leading-relaxed">
          Are you sure you want to cancel this class? This action cannot be undone. Please enter your cancellation token to confirm.
        </p>
        
        <div className="mb-6">
          <label htmlFor="cancellationToken" className="sr-only">Cancellation Token</label>
          <Input
            id="cancellationToken"
            type="text"
            placeholder="Paste token here..."
            value={token}
            onChange={(e) => setToken(e.target.value)}
            error={error || undefined}
          />
        </div>

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="rounded-xl w-full sm:w-auto h-12">
            Keep Class
          </Button>
          <Button variant="destructive" onClick={handleCancel} disabled={isSubmitting} className="rounded-xl w-full sm:w-auto h-12">
            {isSubmitting ? 'Cancelling...' : 'Confirm Cancellation'}
          </Button>
        </div>
      </div>
    </div>
  );
}
