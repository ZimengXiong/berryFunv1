interface LiabilityModalProps {
  isOpen: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export function LiabilityModal({ isOpen, onAccept, onDecline }: LiabilityModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Liability Waiver & Release
          </h2>

          <div className="prose prose-sm max-w-none text-gray-600 space-y-4">
            <p>
              <strong>PLEASE READ CAREFULLY.</strong> By agreeing to this waiver, you acknowledge
              and accept the following terms and conditions:
            </p>

            <h3 className="text-lg font-semibold text-gray-900">Assumption of Risk</h3>
            <p>
              I understand that participation in Berry Fun Camp activities involves inherent risks,
              including but not limited to physical activities, outdoor adventures, sports, arts and
              crafts, and water activities. I voluntarily assume all risks associated with my
              child's participation.
            </p>

            <h3 className="text-lg font-semibold text-gray-900">Medical Authorization</h3>
            <p>
              In the event of an emergency, I authorize Berry Fun Camp staff to obtain necessary
              medical treatment for my child. I agree to be responsible for any medical expenses
              incurred.
            </p>

            <h3 className="text-lg font-semibold text-gray-900">Photo/Video Release</h3>
            <p>
              I grant Berry Fun Camp permission to use photographs and videos of my child for
              promotional and educational purposes.
            </p>

            <h3 className="text-lg font-semibold text-gray-900">Behavior Agreement</h3>
            <p>
              I understand that my child is expected to follow all camp rules and respect staff
              and fellow campers. Failure to do so may result in dismissal from camp without refund.
            </p>

            <h3 className="text-lg font-semibold text-gray-900">Release of Liability</h3>
            <p>
              I hereby release, waive, and forever discharge Berry Fun Camp, its staff, volunteers,
              and affiliates from any and all liability, claims, demands, and causes of action
              arising out of my child's participation in camp activities.
            </p>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:justify-end">
            <button
              onClick={onDecline}
              className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              I Do Not Accept
            </button>
            <button
              onClick={onAccept}
              className="px-6 py-3 bg-berry-600 hover:bg-berry-700 text-white rounded-lg transition-colors font-medium"
            >
              I Accept the Terms
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
