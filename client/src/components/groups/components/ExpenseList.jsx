import { Link } from 'react-router-dom';

const ExpenseList = ({ expenses, groupId, userId, onDeleteExpense }) => (
    <div className="expense-history">
        <h2><i className="fas fa-history"></i> Expense History</h2>
        {expenses.length === 0 ? (
            <div className="empty-state">
                <i className="fas fa-receipt empty-icon"></i>
                <p>No expenses yet. Add one to get started!</p>
                <Link to={`/expenses/add/${groupId}`} className="btn btn-primary">
                    <i className="fas fa-plus-circle"></i> Add First Expense
                </Link>
            </div>
        ) : (
            <div className="expenses-list history-list">
                {expenses.map(expense => (
                    <div key={expense._id} className="expense-item history-item">
                        <div className="expense-header">
                            <h3>{expense.description}</h3>
                            <span className="expense-amount">Rs. {expense.amount.toFixed(2)}</span>
                            {expense.paidBy.user === userId && (
                                <button className="btn btn-danger btn-sm" onClick={() => onDeleteExpense(expense)}>
                                    <i className="fas fa-trash-alt"></i> Delete
                                </button>
                            )}
                        </div>
                        <div className="expense-details">
                            <p>Paid by: {expense.paidBy.name}</p>
                            <p>Date: {new Date(expense.date).toLocaleDateString()} {new Date(expense.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                            <p>Category: {expense.category}</p>
                        </div>
                        <div className="expense-splits">
                            <h4>Split Among:</h4>
                            <ul>
                                {expense.splitAmong.map(split => (
                                    <li key={split.user} className="split-item">
                                        <span>{split.name}: Rs. {split.amount.toFixed(2)}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                ))}
            </div>
        )}
    </div>
);

export default ExpenseList;
