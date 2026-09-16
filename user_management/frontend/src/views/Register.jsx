import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '@/services/api'
import userService from '@/services/userService'
import {
  User, Mail, Phone, Hash, Building, Briefcase, FileText, UserCheck,
  MapPin, ArrowRight, Loader2, CheckCircle, Lock, Eye, EyeOff
} from 'lucide-react'

export const Register = () => {
  const navigate = useNavigate()

  const [role, setRole] = useState('student')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Student specific
  const [rollNumber, setRollNumber] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [departments, setDepartments] = useState([])
  const [hostelId, setHostelId] = useState('')
  const [hostels, setHostels] = useState([])

  // Faculty / Worker specific
  const [employeeId, setEmployeeId] = useState('')

  // Visitor specific
  const [govIdType, setGovIdType] = useState('Aadhaar')
  const [govIdNumber, setGovIdNumber] = useState('')
  const [visitPurpose, setVisitPurpose] = useState('')
  const [hostContact, setHostContact] = useState('')

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [formReady, setFormReady] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setFormReady(true), 50)
    Promise.all([userService.getDepartments(), userService.getHostels()])
      .then(([departmentItems, hostelItems]) => {
        setDepartments(departmentItems)
        setHostels(hostelItems)
      })
      .catch(() => {
        setError('Unable to load department options. Please try again.')
      })
    return () => clearTimeout(timer)
  }, [])

  const isStudent = role === 'student'
  const isFaculty = role === 'faculty'
  const isWorker = role === 'worker'
  const isVisitor = role === 'visitor'

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,12}$/

  const handleRegister = async (e) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (!passwordRegex.test(password)) {
      setError('Password must be 8-12 chars, with uppercase, lowercase, number, and special symbol.')
      return
    }

    setIsLoading(true)

    const payload = {
      role,
      full_name: fullName,
      email,
      phone,
      password
    }

    if (isStudent) {
      payload.roll_number = rollNumber
      payload.department_id = departmentId
      if (hostelId) payload.hostel_id = hostelId
    } else if (isFaculty) {
      payload.employee_id = employeeId
      payload.department_id = departmentId
    } else if (isWorker) {
      payload.employee_id = employeeId
    } else if (isVisitor) {
      payload.gov_id_type = govIdType
      payload.gov_id_number = govIdNumber
      payload.visit_purpose = visitPurpose
      payload.host_contact = hostContact
    }

    try {
      await api.post('/register', payload)
      setSuccess(true)
      setTimeout(() => {
        navigate('/login')
      }, 3000)
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Registration failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={`login-view ${formReady ? 'is-ready' : ''}`}>
      {/* Success State */}
      {success ? (
        <div className="success-state text-center flex flex-col items-center justify-center py-6">
          <div className="success-icon mb-4 text-green-500">
            <CheckCircle size={64} />
          </div>
          <h2 className="login-title mb-2 text-green-700">Registration Successful</h2>
          <p className="login-subtitle mb-6 text-gray-600">
            Your details have been submitted for review. You will be redirected to the login page shortly.
          </p>
          <button onClick={() => navigate('/login')} className="login-btn w-full">
            <span>Go to Login</span>
          </button>
        </div>
      ) : (
        <>
          <div className="auth-tabs">
            <Link to="/login" className="auth-tab">
              Sign In
            </Link>
            <Link to="/register" className="auth-tab active">
              Sign Up
            </Link>
          </div>

          <div className="login-welcome">
            <h2 id="login-heading" className="login-title">
              Create Account
            </h2>
            <p className="login-subtitle">Register for your OCOC Identity</p>
          </div>

          {/* Error banner */}
          {error && (
            <div id="login-error" className="login-error" role="alert">
              <div className="login-error-bar"></div>
              <span>{error}</span>
            </div>
          )}

          <form id="register-form" onSubmit={handleRegister} className="login-form">
            {/* Role Selection */}
            <div className="form-group">
              <label className="form-label">I am a...</label>
              <div className="role-selector">
                <label className={`role-option ${role === 'student' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="role"
                    value="student"
                    checked={role === 'student'}
                    onChange={() => setRole('student')}
                    className="sr-only"
                  />
                  <span>Student</span>
                </label>
                <label className={`role-option ${role === 'faculty' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="role"
                    value="faculty"
                    checked={role === 'faculty'}
                    onChange={() => setRole('faculty')}
                    className="sr-only"
                  />
                  <span>Faculty</span>
                </label>
                <label className={`role-option ${role === 'worker' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="role"
                    value="worker"
                    checked={role === 'worker'}
                    onChange={() => setRole('worker')}
                    className="sr-only"
                  />
                  <span>Worker</span>
                </label>
                <label className={`role-option ${role === 'visitor' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="role"
                    value="visitor"
                    checked={role === 'visitor'}
                    onChange={() => setRole('visitor')}
                    className="sr-only"
                  />
                  <span>Visitor</span>
                </label>
              </div>
            </div>

            <div className="scrollable-fields">
              {/* Full Name */}
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
                    <User size={18} />
                  </div>
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    type="text"
                    required
                    className="form-input pl-9"
                    placeholder="e.g. John Doe"
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Email */}
              <div className="form-group">
                <label className="form-label">Email</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
                    <Mail size={18} />
                  </div>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    required
                    className="form-input pl-9"
                    placeholder="john.doe@example.com"
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Phone */}
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
                    <Phone size={18} />
                  </div>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    type="tel"
                    required
                    className="form-input pl-9"
                    placeholder="10-digit number"
                    pattern="[0-9]{10,15}"
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="form-group">
                <label className="form-label">Password</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
                    <Lock size={18} />
                  </div>
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type={showPassword ? 'text' : 'password'}
                    required
                    className="form-input pl-9"
                    placeholder="8-12 chars, strong"
                    minLength={8}
                    maxLength={12}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    className="field-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
                    <Lock size={18} />
                  </div>
                  <input
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    type={showPassword ? 'text' : 'password'}
                    required
                    className="form-input pl-9"
                    placeholder="Re-enter password"
                    minLength={8}
                    maxLength={12}
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Student Fields */}
              {isStudent && (
                <>
                  <div className="form-group">
                    <label className="form-label">Roll Number</label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
                        <Hash size={18} />
                      </div>
                      <input
                        value={rollNumber}
                        onChange={(e) => setRollNumber(e.target.value)}
                        type="text"
                        required
                        className="form-input pl-9"
                        placeholder="e.g. CS2024001"
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Department</label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
                        <Building size={18} />
                      </div>
                      <select
                        value={departmentId}
                        onChange={(e) => setDepartmentId(e.target.value)}
                        required
                        className="form-input form-select pl-9"
                        disabled={isLoading || !departments.length}
                      >
                        <option value="">Select department…</option>
                        {departments.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Hostel</label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
                        <MapPin size={18} />
                      </div>
                      <select
                        value={hostelId}
                        onChange={(e) => setHostelId(e.target.value)}
                        className="form-input form-select pl-9"
                        disabled={isLoading || !hostels.length}
                      >
                        <option value="">Day scholar / no hostel</option>
                        {hostels.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* Faculty Fields */}
              {isFaculty && (
                <>
                  <div className="form-group">
                    <label className="form-label">Employee ID</label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
                        <Briefcase size={18} />
                      </div>
                      <input
                        value={employeeId}
                        onChange={(e) => setEmployeeId(e.target.value)}
                        type="text"
                        required
                        className="form-input pl-9"
                        placeholder="e.g. FAC001"
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Department</label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
                        <Building size={18} />
                      </div>
                      <select
                        value={departmentId}
                        onChange={(e) => setDepartmentId(e.target.value)}
                        required
                        className="form-input form-select pl-9"
                        disabled={isLoading || !departments.length}
                      >
                        <option value="">Select department…</option>
                        {departments.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* Worker Fields */}
              {isWorker && (
                <div className="form-group">
                  <label className="form-label">Employee ID</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
                      <Briefcase size={18} />
                    </div>
                    <input
                      value={employeeId}
                      onChange={(e) => setEmployeeId(e.target.value)}
                      type="text"
                      required
                      className="form-input pl-9"
                      placeholder="e.g. WRK001"
                      disabled={isLoading}
                    />
                  </div>
                </div>
              )}

              {/* Visitor Fields */}
              {isVisitor && (
                <>
                  <div className="form-group">
                    <label className="form-label">Gov ID Type</label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
                        <FileText size={18} />
                      </div>
                      <select
                        value={govIdType}
                        onChange={(e) => setGovIdType(e.target.value)}
                        required
                        className="form-input form-select pl-9"
                        disabled={isLoading}
                      >
                        <option value="Aadhaar">Aadhaar</option>
                        <option value="PAN">PAN</option>
                        <option value="Passport">Passport</option>
                        <option value="Driving License">Driving License</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Gov ID Number</label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
                        <Hash size={18} />
                      </div>
                      <input
                        value={govIdNumber}
                        onChange={(e) => setGovIdNumber(e.target.value)}
                        type="text"
                        required
                        className="form-input pl-9"
                        placeholder="Enter ID number"
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Visit Purpose</label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
                        <MapPin size={18} />
                      </div>
                      <input
                        value={visitPurpose}
                        onChange={(e) => setVisitPurpose(e.target.value)}
                        type="text"
                        required
                        className="form-input pl-9"
                        placeholder="e.g. Meeting"
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Host Contact (Phone/Email)</label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
                        <UserCheck size={18} />
                      </div>
                      <input
                        value={hostContact}
                        onChange={(e) => setHostContact(e.target.value)}
                        type="text"
                        required
                        className="form-input pl-9"
                        placeholder="Who are you visiting?"
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            <button type="submit" className="btn btn-primary w-full mt-4" disabled={isLoading}>
              {!isLoading ? (
                <>
                  <span>Submit Registration</span>
                  <ArrowRight size={18} className="login-btn-arrow" />
                </>
              ) : (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  <span>Registering...</span>
                </>
              )}
            </button>

            <div className="login-footer">
              <span className="text-muted">Already have an account?</span>
              <Link to="/login" className="field-link ml-1">
                Sign In
              </Link>
            </div>
          </form>
        </>
      )}
    </div>
  )
}

export default Register
