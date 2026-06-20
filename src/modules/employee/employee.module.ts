import { EmployeeRepository } from "./repositories/employee.repository"
import { EmployeeService } from "./employee.service"
import { EmployeeController } from "./employee.controller"

const employeeRepository = new EmployeeRepository()
export const employeeService = new EmployeeService(employeeRepository)

export const employeeController = new EmployeeController(employeeService)
