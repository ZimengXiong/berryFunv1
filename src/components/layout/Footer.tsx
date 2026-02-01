export function Footer() {
  return (
    <footer className="bg-gray-800 text-gray-300 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <span className="text-2xl">🍓</span>
              <span className="text-xl font-bold text-white">Berry Fun Camp</span>
            </div>
            <p className="text-sm">
              Creating unforgettable summer memories for kids of all ages.
            </p>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="/sessions" className="hover:text-white transition-colors">
                  View Sessions
                </a>
              </li>
              <li>
                <a href="/register" className="hover:text-white transition-colors">
                  Register Now
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Contact Us
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4">Contact</h3>
            <ul className="space-y-2 text-sm">
              <li>Email: info@berryfuncamp.com</li>
              <li>Phone: (555) 123-4567</li>
              <li>123 Camp Road, Funville, CA 90210</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-700 mt-8 pt-8 text-center text-sm">
          <p>&copy; {new Date().getFullYear()} Berry Fun Camp. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
