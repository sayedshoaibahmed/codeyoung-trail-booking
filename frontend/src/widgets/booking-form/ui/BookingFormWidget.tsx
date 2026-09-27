import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../shared/ui/button';
import { Input } from '../../../shared/ui/input';
import { useAvailability } from '../../../features/view-availability/model/useAvailability';
import { useBookSlot } from '../../../features/book-slot/model/useBookSlot';
import { SlotCard } from '../../../entities/slot/ui/SlotCard';

const formSchema = z.object({
  parentName: z.string().trim().min(1, 'Parent Name is required'),
  parentEmail: z.string().email('Valid Email is required'),
  childName: z.string().trim().min(1, 'Child Name is required'),
  requestedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
});

type FormValues = z.infer<typeof formSchema>;

export function BookingFormWidget() {
  const navigate = useNavigate();
  const [selectedSlotIso, setSelectedSlotIso] = useState<string | null>(null);
  
  // Use browser timezone guess
  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  const { register, handleSubmit, formState: { errors }, watch } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      parentName: '',
      parentEmail: '',
      childName: '',
      requestedDate: new Date().toISOString().split('T')[0],
    }
  });

  const requestedDate = watch('requestedDate');

  const { slots, isLoading: isSlotsLoading, error: slotsError } = useAvailability(requestedDate, timezone);
  const { book, isSubmitting, error: bookingError } = useBookSlot();

  const onSubmit = async (data: FormValues) => {
    if (!selectedSlotIso) return;
    
    // Requested start should be local time string without TZ suffix
    // selectedSlotIso is UTC, convert it to local
    const dateObj = new Date(selectedSlotIso);
    const tzFormatter = new Intl.DateTimeFormat('sv-SE', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    
    // sv-SE format is almost ISO: "YYYY-MM-DD hh:mm:ss"
    const localString = tzFormatter.format(dateObj).replace(' ', 'T');

    const result = await book({
      parentName: data.parentName,
      parentEmail: data.parentEmail,
      childName: data.childName,
      parentTimezone: timezone,
      requestedStartIso: localString,
    });

    if (result) {
      // Pass the cancellation token through state so it doesn't leak into URL
      navigate(`/confirmation/${result.bookingId}`, { 
        state: { cancellationToken: result.cancellationToken } 
      });
    }
  };

  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-teal-950">Book a Trial Class</h2>
        <div className="mt-2 sm:mt-0 text-sm font-medium text-slate-500 bg-slate-50 px-3 py-1.5 rounded-full inline-flex items-center border border-slate-100">
          <svg className="w-4 h-4 mr-1.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          {timezone}
        </div>
      </div>

      {bookingError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex flex-col items-start shadow-sm">
          <p className="text-sm text-red-800 font-semibold flex items-center">
            <span className="mr-2">⚠️</span> {bookingError.message}
          </p>
          {bookingError.alternateSlots && bookingError.alternateSlots.length > 0 && (
            <div className="mt-3 w-full">
              <p className="text-xs text-red-600 mb-2 font-medium">Alternative available slots:</p>
              <div className="flex flex-wrap gap-2">
                {bookingError.alternateSlots.map((alt: any, i: number) => {
                  const t = new Intl.DateTimeFormat('en-US', {
                    hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric'
                  }).format(new Date(alt.startUtc));
                  return <span key={i} className="text-xs px-2.5 py-1 bg-white border border-red-200 text-red-700 rounded-md font-medium">{t}</span>;
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label htmlFor="parentName" className="block text-sm font-semibold text-slate-700 mb-1.5">Parent Name</label>
            <Input id="parentName" {...register('parentName')} error={errors.parentName?.message} placeholder="e.g. John Doe" />
          </div>
          <div>
            <label htmlFor="parentEmail" className="block text-sm font-semibold text-slate-700 mb-1.5">Parent Email</label>
            <Input id="parentEmail" type="email" {...register('parentEmail')} error={errors.parentEmail?.message} placeholder="john@example.com" />
          </div>
          <div>
            <label htmlFor="childName" className="block text-sm font-semibold text-slate-700 mb-1.5">Child's Name</label>
            <Input id="childName" {...register('childName')} error={errors.childName?.message} placeholder="e.g. Jane" />
          </div>
          <div>
            <label htmlFor="requestedDate" className="block text-sm font-semibold text-slate-700 mb-1.5">Date</label>
            <Input id="requestedDate" type="date" {...register('requestedDate')} error={errors.requestedDate?.message} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-teal-950">Select a Time Slot</h3>
            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">Duration: 1 Hour</span>
          </div>
          
          {slotsError && <p className="text-sm text-red-600 font-medium p-3 bg-red-50 rounded-lg">{slotsError}</p>}
          {isSlotsLoading ? (
            <div className="animate-pulse flex gap-3 flex-wrap">
              {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-14 w-32 bg-slate-100 rounded-lg"></div>)}
            </div>
          ) : slots.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {slots.map(slot => (
                <SlotCard
                  key={slot.startUtc}
                  slot={slot}
                  timezone={timezone}
                  isSelected={selectedSlotIso === slot.startUtc}
                  onClick={() => setSelectedSlotIso(slot.startUtc)}
                />
              ))}
            </div>
          ) : (
            <div className="p-8 border-2 border-dashed border-slate-200 rounded-xl text-center bg-slate-50">
              <p className="text-slate-500 font-medium">No slots available for this date.</p>
              <p className="text-slate-400 text-sm mt-1">Please try selecting another day.</p>
            </div>
          )}
        </div>

        <div className="pt-6 border-t border-slate-100">
          <Button 
            type="submit" 
            className="w-full sm:w-auto text-base px-8 py-6 rounded-xl"
            disabled={!selectedSlotIso || isSubmitting}
          >
            {isSubmitting ? 'Securing your slot...' : 'Confirm Booking'}
          </Button>
        </div>
      </form>
    </div>
  );
}
