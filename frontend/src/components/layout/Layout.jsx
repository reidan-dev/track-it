import Sidebar from './Sidebar'

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <main className="flex-1 ml-56 p-6 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
