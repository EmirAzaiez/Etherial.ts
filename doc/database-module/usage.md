# Database | Usage & Models

In the world of modern web development, a robust and efficient database interaction layer is essential. Etherial.TS recognizes this need and places a strong emphasis on using a comprehensive and well-maintained Object-Relational Mapping (ORM) tool. This choice ensures that your database operations are not only smooth but also scalable and maintainable over time.

For our model and database layer, we have chosen to leverage the power of [Sequelize](https://github.com/sequelize/sequelize-typescript) along with TypeScript. Sequelize is a battle-tested ORM that has been maintained and refined for many years. Its TypeScript version provides type safety and ensures that your database interactions are seamless and free from runtime errors.

---

## 📝 Defining Models

To define a model using Sequelize in Etherial.TS, you can use the decorators provided by `sequelize-typescript`.

### Best Practices

As a best practice, Etherial.TS recommends naming your models in the singular form, such as "User" for an individual user entity. However, when it comes to the actual database tables, they should follow the plural convention, like "users" for the "users" table. This consistent naming convention ensures clarity and consistency in your database structure.

### Example

Here, we've created a `User` model that represents the "users" table in the database. Note the use of TypeScript for strong typing and Sequelize decorators to define table properties.

```typescript
import { Table, Column, Model, DataType } from 'sequelize-typescript'

@Table({
    tableName: 'users',
    timestamps: true,
})
export class User extends Model {
    @Column({
        type: DataType.STRING,
        allowNull: false,
    })
    name: string

    @Column({
        type: DataType.STRING,
        unique: true,
    })
    email: string
}
```

---

## 📦 Usage

Once configured, the Database module is available globally via the `etherial` instance.

### Accessing the Module

You can access the database instance anywhere in your code keying into the module name defined in `Config.ts` (usually `database`).

```typescript
import etherial from 'etherial'

// Access the initialized module
const db = etherial.database
```

### Core Methods

#### Transactions

Execute a callback within a managed transaction. If the callback throws an error, the transaction is rolled back automatically.

```typescript
await db.transaction(async (t) => {
    const user = await User.create({ name: 'Alice' }, { transaction: t })
    await Account.create({ userId: user.id }, { transaction: t })
})
```

#### Sync

Synchronize models with the database.

```typescript
// Standard sync (creates tables if not exist)
await db.sync()

// Force sync (drops tables first) - CAREFUL!
await db.sync({ force: true })

// Alter sync (updates tables to match models)
await db.sync({ alter: true })
```

#### Adding Models Dynamically

You can add models at runtime (e.g., within a Leaf).

```typescript
db.addModels([MyCustomModel])
```
