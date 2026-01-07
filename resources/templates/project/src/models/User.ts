import {
    Table,
    Column,
    Model,
    AllowNull,
    PrimaryKey,
    AutoIncrement,
} from "etherial/components/database/provider";

@Table({
    timestamps: true,
    tableName: "users",
    freezeTableName: true,
})
export class User extends Model<User> {
    @AutoIncrement
    @PrimaryKey
    @AllowNull(false)
    @Column
    id: number;

    @AllowNull(false)
    @Column
    firstname: string;

    @AllowNull(false)
    @Column
    lastname: string;

    @AllowNull(false)
    @Column
    email: string;

    @AllowNull(true)
    @Column
    password: string;
}