import { TypeOrmEmployeeRepository } from "./repositories/typeorm-employee.repository"
import { EmployeeService } from "./employee.service"
import { EmployeeController } from "./employee.controller"

const employeeRepository = new TypeOrmEmployeeRepository()
const employeeService = new EmployeeService(employeeRepository)

export const employeeController = new EmployeeController(employeeService)
